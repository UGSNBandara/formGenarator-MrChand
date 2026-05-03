# AdaptiveBP — Project Architecture Documentation

> **Last updated:** 2026-02-25  
> **Architecture style:** Modular Monolith with standard layering  
> **Status:** Active development (`dev-dasun` branch)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [High-Level System Architecture](#3-high-level-system-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [API Surface](#6-api-surface)
7. [Security & Authentication](#7-security--authentication)
8. [Data Layer](#8-data-layer)
9. [Known Legacy Code](#9-known-legacy-code)
10. [Directory Structure Reference](#10-directory-structure-reference)

---

## 1. Project Overview

**AdaptiveBP** is a cloud-based, multi-tenant business platform for SMBs. It allows business owners to create **organisations** (domains), invite **users**, manage **applications** within those domains, and build structured **data models** (forms/schemas) per application.

### Core Concepts

| Concept | Description |
|---|---|
| **Owner** | A platform-level account that creates and manages one or more organisations |
| **Organisation (Domain)** | A tenant workspace identified by a unique slug |
| **Domain User** | A user within a specific organisation, invited or self-registered |
| **Application** | A named workspace within an organisation (e.g. "Inventory", "CRM") |
| **Domain Model** | A structured data schema (fields + types) belonging to a domain, optionally scoped to an app |
| **Group** | RBAC unit — domain groups grant domain-level permissions; app groups grant app-level permissions |

### Multi-Tenant Hierarchy

```
Platform
 └── Owner Account
      └── Organisation (Domain)
           ├── Domain Groups (RBAC)
           ├── Domain Users
           └── Application
                ├── App Groups (RBAC)
                └── Domain Models (schemas)
```

---

## 2. Technology Stack

### Backend

| Component | Technology | Version |
|---|---|---|
| Runtime | Java | 17 |
| Framework | Spring Boot | 3.3.1 |
| Database | MongoDB Atlas | Cloud-hosted |
| Authentication | JWT (JJWT) | 0.12.6 |
| Password hashing | BCrypt | (Spring Security) |
| Build tool | Maven | (wrapper included) |
| Env management | spring-dotenv | 4.0.0 |
| Validation | spring-boot-starter-validation | (managed) |

### Frontend

| Component | Technology | Version |
|---|---|---|
| Framework | Angular | 17.3.x |
| Language | TypeScript | 5.4.x |
| UI framework | Bootstrap | 5.3.3 |
| JWT handling | @auth0/angular-jwt | 5.2.0 |
| State | Local + SessionStorage | — |

### Infrastructure

| Component | Detail |
|---|---|
| Backend port | `8005` |
| Frontend port | `4200` (dev) |
| Database | MongoDB Atlas (URI via `SPRING_DATA_MONGODB_URI` env var) |
| Env file | `.env` at project root (loaded by spring-dotenv) |

---

## 3. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User (Browser)                        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
         ┌─────────────▼─────────────┐
         │   Angular 17 SPA          │
         │   (localhost:4200)         │
         │                           │
         │  ┌─core/──────────────┐   │
         │  │ AuthService        │   │
         │  │ DomainService      │   │
         │  │ BaseService (HTTP) │   │
         │  │ Guards & Interceptor│  │
         │  └────────────────────┘   │
         │  ┌─features/──────────┐   │
         │  │ auth, dashboard,   │   │
         │  │ organisation,      │   │
         │  │ application,       │   │
         │  │ form-builder       │   │
         │  └────────────────────┘   │
         └─────────────┬─────────────┘
                       │ REST (JSON)
                       │ JWT via cookie + header
         ┌─────────────▼─────────────┐
         │   Spring Boot 3.3.1       │
         │   (localhost:8005)         │
         │                           │
         │  ┌─shared/────────────┐   │
         │  │ Security (JWT)     │   │
         │  │ Config (CORS,Mongo)│   │
         │  │ Exception handling │   │
         │  └────────────────────┘   │
         │  ┌─modules/───────────┐   │
         │  │ identity           │   │
         │  │ organisation       │   │
         │  │ appmanagement      │   │
         │  │ formbuilder        │   │
         │  └────────────────────┘   │
         └─────────────┬─────────────┘
                       │ Spring Data MongoDB
         ┌─────────────▼─────────────┐
         │   MongoDB Atlas           │
         │   (cloud)                 │
         └───────────────────────────┘
```

---

## 4. Backend Architecture

### Package Structure

```
com.adaptivebp
├── AdaptiveBpApplication.java              ← Spring Boot entry point
│
├── shared/                                 ← Cross-cutting concerns
│   ├── audit/
│   │   └── Auditable.java                  ← Base audit fields (created/updated timestamps)
│   ├── config/
│   │   ├── CorsConfig.java                 ← CORS configuration
│   │   ├── MongoConfig.java                ← MongoDB connection config
│   │   └── WebSecurityConfig.java          ← Spring Security filter chain
│   ├── exception/
│   │   └── GlobalExceptionHandler.java     ← @ControllerAdvice error handling
│   └── security/
│       ├── AdaptiveUserDetails.java         ← Multi-tenant UserDetails (new)
│       ├── AuthEntryPoint.java              ← 401 handler
│       ├── JwtAuthFilter.java               ← OncePerRequestFilter for JWT
│       ├── JwtPrincipalClaims.java          ← JWT claim value object
│       ├── JwtTokenProvider.java            ← Token generation & validation
│       ├── PrincipalType.java               ← Enum: OWNER | DOMAIN_USER
│       ├── UserDetailsImpl.java             ← Legacy UserDetails (for /custom_form)
│       └── UserDetailsServiceImpl.java      ← Legacy UserDetailsService
│
├── modules/
│   ├── identity/                           ← Authentication & user management
│   │   ├── controller/
│   │   │   ├── AuthController.java          ← Legacy: /custom_form/auth/**
│   │   │   ├── OwnerAuthController.java     ← /adaptive/auth/owner/**
│   │   │   ├── DomainAuthController.java    ← /adaptive/domains/{slug}/auth/**
│   │   │   └── UserController.java          ← Legacy: /custom_form/user/**
│   │   ├── dto/request/
│   │   │   ├── ChangePasswordRequest
│   │   │   ├── CreateRoleRequest
│   │   │   ├── DomainLoginRequest
│   │   │   ├── DomainSignupRequest
│   │   │   ├── LoginRequest                 ← Legacy
│   │   │   ├── OwnerLoginRequest
│   │   │   ├── OwnerSignupRequest
│   │   │   └── SignupRequest                ← Legacy
│   │   ├── dto/response/
│   │   │   ├── AuthResponse
│   │   │   ├── MessageResponse
│   │   │   └── UserInfoResponse
│   │   ├── model/
│   │   │   ├── DomainUser.java              ← Multi-tenant user
│   │   │   ├── OwnerAccount.java            ← Platform owner
│   │   │   ├── ERole.java                   ← Legacy role enum
│   │   │   ├── Role.java                    ← Legacy role entity
│   │   │   └── User.java                    ← Legacy user entity
│   │   ├── repository/
│   │   │   ├── DomainUserRepository.java
│   │   │   ├── OwnerAccountRepository.java
│   │   │   ├── RoleRepository.java          ← Legacy
│   │   │   └── UserRepository.java          ← Legacy
│   │   └── service/
│   │       └── AdaptivePrincipalService.java ← Resolves principal by type
│   │
│   ├── organisation/                       ← Domain (tenant) management
│   │   ├── controller/
│   │   │   ├── OrganisationController.java  ← /custom_form/domain/**
│   │   │   ├── DomainAccessController.java  ← /adaptive/domains/{slug}/access/**
│   │   │   └── DomainGroupController.java   ← /adaptive/domains/{slug}/groups/**
│   │   ├── dto/request/
│   │   │   ├── AssignMemberRequest
│   │   │   ├── CreateDomainGroupRequest
│   │   │   └── CreateOrganisationRequest
│   │   ├── dto/response/
│   │   │   ├── DomainAccessResponse
│   │   │   ├── DomainUserResponse
│   │   │   ├── GroupMemberResponse
│   │   │   └── OrganisationResponse
│   │   ├── model/
│   │   │   ├── Organisation.java
│   │   │   ├── DomainGroup.java
│   │   │   └── DomainGroupMember.java
│   │   ├── permission/
│   │   │   └── DomainPermission.java        ← Permission enum
│   │   ├── repository/
│   │   │   ├── OrganisationRepository.java
│   │   │   ├── DomainGroupRepository.java
│   │   │   └── DomainGroupMemberRepository.java
│   │   └── service/
│   │       ├── DomainProvisioningService.java ← Default groups on domain create
│   │       └── PermissionService.java         ← RBAC permission checks
│   │
│   ├── appmanagement/                      ← Application management within domains
│   │   ├── controller/
│   │   │   ├── ApplicationController.java   ← /adaptive/domains/{slug}/apps/**
│   │   │   └── AppGroupController.java      ← /adaptive/domains/{slug}/apps/{appSlug}/groups/**
│   │   ├── dto/request/
│   │   │   ├── CreateAppGroupRequest
│   │   │   └── CreateApplicationRequest
│   │   ├── dto/response/
│   │   │   ├── AppGroupMemberResponse
│   │   │   └── AppUserResponse
│   │   ├── model/
│   │   │   ├── Application.java
│   │   │   ├── AppGroup.java
│   │   │   └── AppGroupMember.java
│   │   ├── permission/
│   │   │   └── AppPermission.java           ← Permission enum
│   │   ├── repository/
│   │   │   ├── ApplicationRepository.java
│   │   │   ├── AppGroupRepository.java
│   │   │   └── AppGroupMemberRepository.java
│   │   └── service/
│   │       └── ApplicationProvisioningService.java ← Default groups on app create
│   │
│   └── formbuilder/                        ← Data model (schema) management
│       ├── controller/
│       │   ├── DomainModelController.java   ← /adaptive/domains/{slug}/models/**
│       │   └── CustomFormController.java    ← Legacy: /custom_form/**
│       ├── dto/request/
│       │   ├── CreateDomainModelRequest
│       │   └── UpdateDomainModelRequest
│       ├── model/
│       │   ├── DomainModel.java
│       │   ├── DomainModelField.java
│       │   ├── DomainFieldType.java
│       │   └── legacy/                     ← 15 legacy model files (to be removed)
│       └── repository/
│           ├── DomainModelRepository.java   ← Active
│           ├── CustomFormRepository.java    ← Legacy
│           ├── CustomFormDataRepository.java ← Legacy
│           ├── CustomOptionRepository.java  ← Legacy
│           ├── CustomRegularExpressionRepository.java ← Legacy
│           └── FormFieldRepository.java     ← Legacy
```

### Layering Pattern (Per Module)

Each module follows standard **Controller → Service → Repository** layering:

```
Controller          ← REST endpoints, input validation, authorization checks
    │
    ▼
Service             ← Business logic, provisioning, cross-module coordination
    │
    ▼
Repository          ← Spring Data MongoDB CRUD interface
    │
    ▼
Model               ← MongoDB document entities (@Document)

DTO/                ← Request/Response objects (never expose models directly)
  ├── request/      ← Incoming payloads
  └── response/     ← Outgoing payloads
```

### Module Dependencies

```
shared ←── identity
shared ←── organisation ──→ identity (PermissionService checks principal type)
shared ←── appmanagement ──→ organisation (needs domain context)
shared ←── formbuilder ──→ appmanagement + organisation (scoped to domain+app)
```

> **Rule:** Modules may depend on `shared` and on sibling modules, but never create circular dependencies. `shared` depends on no module (except `identity` models via `UserDetailsServiceImpl` — a legacy coupling to be removed).

---

## 5. Frontend Architecture

### Module Structure

```
src/app/
├── app.module.ts                  ← Root: AppComponent + CoreModule + SharedModule + routing
├── app-routing.module.ts          ← Root router with lazy-loaded feature routes
├── app.component.ts               ← Shell component (<router-outlet>)
│
├── core/                          ← Singleton services, guards, interceptors (imported ONCE in root)
│   ├── core.module.ts
│   ├── guards/
│   │   ├── auth.guard.ts          ← Checks login state
│   │   └── domain.guard.ts        ← Checks domain membership
│   ├── interceptors/
│   │   └── auth.interceptor.ts    ← Attaches JWT to outgoing requests
│   ├── models/
│   │   └── form.model.ts          ← Shared TypeScript interfaces
│   └── services/
│       ├── api.service.ts          ← BaseService — generic HTTP wrapper (GET/POST/PUT/DELETE)
│       ├── auth.service.ts         ← Login, logout, signup, JWT cookie management
│       └── domain.service.ts       ← Domain CRUD, groups, apps, models
│
├── shared/                         ← Reusable UI components, exported to all features
│   ├── shared.module.ts
│   └── components/
│       ├── navbar/navi-bar.component
│       ├── navi-data/navi-data.component
│       └── not-found-page/not-found-page.component
│
└── features/                       ← Lazy-loaded feature modules
    ├── auth/                       ← Login, signup flows
    │   ├── auth.module.ts
    │   └── pages/
    │       ├── login/
    │       ├── owner-signup/
    │       ├── domain-login/
    │       └── domain-signup/
    │
    ├── dashboard/                  ← Landing page after login
    │   ├── dashboard.module.ts
    │   └── pages/
    │       └── home-page/
    │
    ├── organisation/               ← Domain management
    │   ├── organisation.module.ts
    │   └── pages/
    │       ├── org-create/          ← Create new domain
    │       ├── org-home/            ← Domain dashboard
    │       └── org-members/         ← User & group management
    │
    ├── application/                ← App management within a domain
    │   ├── application.module.ts
    │   └── pages/
    │       ├── app-home/            ← App dashboard
    │       └── app-models/          ← List domain models for an app
    │
    └── form-builder/               ← Schema/model designer
        ├── form-builder.module.ts
        ├── components/
        │   ├── field-properties/    ← Edit field config
        │   ├── field-renderer/      ← Render a field preview
        │   ├── regular-expression/  ← Regex validation config
        │   └── select-options/      ← Dropdown option editor
        └── pages/
            ├── form-designer/       ← Model builder (drag & drop fields)
            ├── form-preview/        ← Live preview of a model as a form
            └── form-data/           ← View data entered via a model
```

### Routing Map

All feature modules are **lazy-loaded** via `loadChildren()`:

| Route | Feature Module | Guard | Component |
|---|---|---|---|
| `/` | `DashboardModule` | — | `HomePageComponent` |
| `/auth/login` | `AuthModule` | — | `LoginComponent` |
| `/auth/owner-signup` | `AuthModule` | — | `OwnerSignupComponent` |
| `/auth/domain-login` | `AuthModule` | — | `DomainLoginComponent` |
| `/auth/domain-signup` | `AuthModule` | — | `DomainSignupComponent` |
| `/domain/create` | `OrganisationModule` | `AuthGuard` | `DomainCreateComponent` |
| `/domain/:slug` | `OrganisationModule` | `AuthGuard` | `DomainHomeComponent` |
| `/domain/:slug/users` | `OrganisationModule` | `AuthGuard` | `DomainUsersComponent` |
| `/domain/:slug/app/:appSlug` | `ApplicationModule` | `AuthGuard` | `AppHomeComponent` |
| `/domain/:slug/app/:appSlug/models` | `ApplicationModule` | `AuthGuard` | `AppModelsComponent` |
| `/form-builder` | `FormBuilderModule` | `AuthGuard` | `ModelPageComponent` |
| `/form-builder/preview` | `FormBuilderModule` | `AuthGuard` | `RenderFormComponent` |
| `/form-builder/data` | `FormBuilderModule` | `AuthGuard` | `DataComponent` |

Legacy redirect routes: `/login` → `/auth/login`, `/owner-login` → `/auth/owner-login`, `/owner-signup` → `/auth/owner-signup`, `/domain-login` → `/auth/domain-login`, `/domain-signup` → `/auth/domain-signup`, `/create-domain` → `/domain/create`.

---

## 6. API Surface

The backend exposes two API generations via two base paths:

### New API: `/adaptive/**` (multi-tenant)

| Module | Base Path | Endpoints |
|---|---|---|
| **Identity** | `/adaptive/auth/owner` | `POST /signup`, `POST /login` |
| **Identity** | `/adaptive/domains/{slug}/auth` | `POST /signup`, `POST /login` |
| **Organisation** | `/adaptive/domains/{slug}/access` | `GET /me` |
| **Organisation** | `/adaptive/domains/{slug}/groups` | `GET /`, `GET /users`, `GET /{groupId}/members`, `POST /{groupId}/members`, `GET /users/{userId}`, `DELETE /{groupId}/members/{userId}` |
| **App Mgmt** | `/adaptive/domains/{slug}/apps` | `GET /`, `GET /{appSlug}`, `POST /` |
| **App Mgmt** | `/adaptive/domains/{slug}/apps/{appSlug}/groups` | `GET /`, `GET /users`, `GET /{groupId}/members`, `POST /`, `POST /{groupId}/members`, `GET /users/{userId}`, `DELETE /{groupId}/members/{userId}` |
| **Form Builder** | `/adaptive/domains/{slug}/models` | `GET /`, `GET /{modelSlug}`, `POST /`, `PUT /{modelSlug}`, `DELETE /{modelSlug}` |

### Legacy API: `/custom_form/**` (to be deprecated)

| Module | Base Path | Endpoints |
|---|---|---|
| **Identity** | `/custom_form/auth` | `POST /login`, `POST /signup` |
| **Identity** | `/custom_form/user` | `POST /change-password`, `POST /roles`, `POST /{userIdentity}/roles` |
| **Organisation** | `/custom_form/domain` | `POST /`, `GET /`, `GET /{id}`, `GET /slug/{slug}` |
| **Form Builder** | `/custom_form` | `GET /model/all`, `GET /data/all`, `GET /model/{id}`, `GET /data/{name}`, `GET /data/{name}/{id}`, `POST /data/add`, `POST /model/create` |

---

## 7. Security & Authentication

### Dual Authentication Flow

The system runs **two authentication paths** simultaneously via `JwtAuthFilter`:

```
Incoming Request
    │
    ▼
JwtAuthFilter.doFilterInternal()
    │
    ├── Extract JWT from cookie or "token" header
    │
    ├── Parse claims → check for "pid" + "ptype" fields
    │   │
    │   ├── YES (new /adaptive tokens):
    │   │   → AdaptivePrincipalService.loadById()
    │   │   → Sets AdaptiveUserDetails in SecurityContext
    │   │
    │   └── NO (legacy /custom_form tokens):
    │       → UserDetailsServiceImpl.loadByUsername()
    │       → Sets UserDetailsImpl in SecurityContext
    │
    ▼
SecurityFilterChain (WebSecurityConfig)
    │
    ├── /adaptive/auth/**, /custom_form/auth/** → permitAll
    ├── /adaptive/**                           → authenticated
    ├── /custom_form/model/**                  → APP_ADMIN, DOMAIN_ADMIN, BUSINESS_OWNER
    ├── /custom_form/data/**                   → + BUSINESS_USER
    ├── /custom_form/**                        → authenticated
    └── everything else                        → denyAll
```

### JWT Token Structure

**Legacy token** (from `AuthController`):
```json
{ "sub": "username", "iat": ..., "exp": ... }
```

**Adaptive token** (from `OwnerAuthController` / `DomainAuthController`):
```json
{
  "sub": "username_or_email",
  "pid": "principalId",
  "ptype": "OWNER | DOMAIN_USER",
  "domainId": "orgId_or_null",
  "iat": ...,
  "exp": ...
}
```

### RBAC Permission Model

Permissions are resolved by `PermissionService` using group memberships:

**Domain-level** (`DomainPermission` enum):
- Checked via `DomainGroup` → `DomainGroupMember` chain
- Owners automatically get ALL domain permissions
- Default groups created on domain provisioning: "Domain Admin" (all), "Domain Contributor" (MANAGE_APPS + USE_APP)

**App-level** (`AppPermission` enum):
- Checked via `AppGroup` → `AppGroupMember` chain
- Owners automatically get ALL app permissions
- Default groups created on app provisioning: "App Admin" (READ+WRITE+EXECUTE), "App Editor" (READ+WRITE), "App Viewer" (READ)

### User Classes and Characteristics

The platform’s user classification is split into two tiers: **System-Level Identity & Roles** (which handle broad access and administrative scopes) and **Domain-Level Configurable Groups** (which handle granular application and workflow permissions).

#### 1. System-Level Identity & Roles
These are the foundational classes enforced by the internal `PrincipalType` and `ERole` enums. They determine what a user can fundamentally do within the platform architecture:

*   **Business Owner (`OWNER` / `ROLE_BUSINESS_OWNER`)**: The primary account holder who owns the Organisation. They possess global administrative rights over billing, domain settings, custom branding, and overarching management across the entire business.
*   **Domain Admin (`DOMAIN_USER` / `ROLE_DOMAIN_ADMIN`)**: A highly privileged user who oversees a specific domain. They manage domain users, create custom groups, and manage all applications within their domain structure.
*   **App Admin (`DOMAIN_USER` / `ROLE_APP_ADMIN`)**: A delegated administrator tasked with managing specific applications. They build Domain Models, design Workflows, and assemble user interfaces but are restricted to their assigned apps.
*   **Business User (`DOMAIN_USER` / `ROLE_BUSINESS_USER`)**: Standard employees who form the majority of the user base. They interact with the system to consume applications, fill out forms, and advance workflows.

#### 2. Domain-Level Permissions & Workflow Groups
Because "Business Users" all share the same system role, horizontal access and workflow routing are enforced dynamically using `DomainGroup` structures configured by Admins. There are two distinct types (`DomainGroupType`):

*   **Access Groups (`ACCESS`)**: These groups define *application and data visibility*. Business Users are placed into Access Groups (e.g., "HR Department", "Field Techs") to govern which specific Apps, Forms, and Dashboards they are allowed to see and interact with.
*   **Workflow Roles (`WORKFLOW_ROLE`)**: These are dynamic permission groups used strictly for process execution. Instead of hard-coding steps to specific users, steps in a process (e.g., a "Manager Approval" step) are assigned to a Workflow Role (e.g., "HR Approvers", "Finance Reviewers"). Business users assigned to these Workflow Roles are subsequently granted the authority to claim and execute the tasks generated by those workflow steps.

---

## 8. Data Layer

### Database

- **MongoDB Atlas** (cloud-hosted)
- Connection via `SPRING_DATA_MONGODB_URI` environment variable
- Spring Data MongoDB repositories with `MongoRepository<T, String>` interfaces

### Collections (Active)

| Collection | Model Class | Module | Description |
|---|---|---|---|
| `ownerAccounts` | `OwnerAccount` | identity | Platform-level owner accounts |
| `domainUsers` | `DomainUser` | identity | Users scoped to a domain |
| `organisations` | `Organisation` | organisation | Tenant/domain records |
| `domainGroups` | `DomainGroup` | organisation | Domain-level RBAC groups |
| `domainGroupMembers` | `DomainGroupMember` | organisation | Group membership records |
| `applications` | `Application` | appmanagement | Apps within a domain |
| `appGroups` | `AppGroup` | appmanagement | App-level RBAC groups |
| `appGroupMembers` | `AppGroupMember` | appmanagement | App group memberships |
| `domainModels` | `DomainModel` | formbuilder | Data schemas with field definitions |

### Collections (Legacy — still in database)

| Collection | Model Class | Description |
|---|---|---|
| `users` | `User` | Legacy user accounts (username/password + role references) |
| `roles` | `Role` | Legacy role records (ERole enum values) |
| `CustomForm` | `CustomForm` | Legacy form templates |
| `CustomFormData` | `CustomFormData` | Legacy form submissions |
| `CustomOptions` | `CustomOptions` | Legacy field option sets |
| `CustomRegularExpression` | `CustomRegularExpression` | Legacy regex validation rules |

---

## 9. Known Legacy Code

The following legacy code still exists in the codebase and is planned for removal once the `/custom_form` API is fully deprecated:

### Backend — Legacy Files

| Location | Files | Reason to keep (for now) |
|---|---|---|
| `shared/security/` | `UserDetailsImpl`, `UserDetailsServiceImpl` | Still used by `JwtAuthFilter` for legacy `/custom_form` tokens |
| `modules/identity/controller/` | `AuthController`, `UserController` | Legacy `/custom_form/auth` and `/custom_form/user` endpoints |
| `modules/identity/model/` | `User`, `Role`, `ERole` | Referenced by `UserDetailsServiceImpl` |
| `modules/identity/repository/` | `UserRepository`, `RoleRepository` | Referenced by `UserDetailsServiceImpl` |
| `modules/identity/dto/request/` | `LoginRequest`, `SignupRequest` | Used by legacy `AuthController` |
| `modules/formbuilder/controller/` | `CustomFormController` | Legacy `/custom_form` form CRUD |
| `modules/formbuilder/model/legacy/` | 15 files: Actions, Auth, BaseAuth, CustomForm, CustomFormData, CustomOptions, CustomRegularExpression, DataAuth, DataStatus, FormField, FormFieldData, ModelAuth, ModelStatus, Process, Status | Used only by `CustomFormController` |
| `modules/formbuilder/repository/` | `CustomFormRepository`, `CustomFormDataRepository`, `CustomOptionRepository`, `CustomRegularExpressionRepository`, `FormFieldRepository` | Used only by `CustomFormController` |

### Frontend — Legacy Dependencies in `package.json`

| Package | Issue |
|---|---|
| `jquery` | Not needed in Angular |
| `d3` | Not used |
| `express`, `cors`, `http` | Server-side packages, don't belong in Angular app |
| `ids-enterprise-ng` | Not imported anywhere |
| `@angular/*: "*"` | Several Angular packages use wildcard versioning instead of `^17.3.x` |

---

## 10. Directory Structure Reference

### Project Root

```
formGenarator-MrChand/
├── .env                          ← Environment variables (gitignored)
├── .env.example                  ← Template for .env
├── .gitignore
├── README.md
├── CONTRIBUTION.md
├── LICENSE
├── NEXT_STEPS.md
│
├── Backend/
│   ├── api/                      ← Spring Boot application
│   │   ├── pom.xml
│   │   ├── Dockerfile
│   │   ├── mvnw / mvnw.cmd
│   │   └── src/
│   │       ├── main/java/com/adaptivebp/    ← Application code
│   │       ├── main/resources/              ← application.properties
│   │       └── test/                        ← Tests
│   └── DB/
│       ├── dump/                 ← MongoDB backup (BSON)
│       └── generator/            ← Seed/migration scripts (Node.js)
│
├── Frontend/
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.html
│       ├── main.ts
│       ├── styles.css
│       └── app/                  ← Angular application code
│
└── docs/
    └── architecture/             ← This documentation
```
