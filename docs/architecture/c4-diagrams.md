# AdaptiveBP — C4 Architecture Diagrams

> **Last updated:** 2026-05-03  
> **Notation:** [C4 Model](https://c4model.com/) rendered with Mermaid  
> **Scope:** Documents the **current** system as deployed, not aspirational targets

---

## Table of Contents

1. [Level 1 — System Context Diagram](#level-1--system-context-diagram)
2. [Level 2 — Container Diagram](#level-2--container-diagram)
3. [Level 3 — Component Diagram (Backend)](#level-3--component-diagram-backend)
4. [Level 3 — Component Diagram (Frontend)](#level-3--component-diagram-frontend)
5. [Level 4 — Code Diagram: Identity Module](#level-4--code-diagram-identity-module)
6. [Level 4 — Code Diagram: Organisation Module](#level-4--code-diagram-organisation-module)
7. [Level 4 — Code Diagram: App Management Module](#level-4--code-diagram-app-management-module)
8. [Level 4 — Code Diagram: Form Builder Module](#level-4--code-diagram-form-builder-module)
9. [Level 4 — Code Diagram: Security (shared)](#level-4--code-diagram-security-shared)
10. [Deployment Diagram](#deployment-diagram)

---

## Level 1 — System Context Diagram

*Who uses AdaptiveBP and what external systems does it interact with?*

```mermaid
C4Context
    title System Context – AdaptiveBP

    Person(owner, "Business Owner", "Creates organisations, manages apps and users")
    Person(domainUser, "Domain User", "Works within an organisation using apps")

    System(adaptiveBP, "AdaptiveBP Platform", "Multi-tenant business platform for SMBs. Allows creating organisations, applications, data models, and managing users with RBAC.")

    System_Ext(mongoAtlas, "MongoDB Atlas", "Cloud-hosted NoSQL database service")
    System_Ext(browser, "Web Browser", "Chrome, Firefox, Edge, Safari")

    Rel(owner, adaptiveBP, "Manages orgs, apps, users", "HTTPS")
    Rel(domainUser, adaptiveBP, "Uses applications", "HTTPS")
    Rel(adaptiveBP, mongoAtlas, "Stores data", "MongoDB Wire Protocol / TLS")
    Rel(owner, browser, "Accesses via")
    Rel(domainUser, browser, "Accesses via")
```

---

## Level 2 — Container Diagram

*What are the major deployable units that make up AdaptiveBP?*

```mermaid
C4Container
    title Container Diagram – AdaptiveBP

    Person(user, "User", "Business Owner or Domain User")

    Container_Boundary(platform, "AdaptiveBP Platform") {
        Container(spa, "Frontend SPA", "Angular 17, TypeScript", "Single-page application served to the browser. Lazy-loaded feature modules for auth, domains, apps, and form builder.")
        Container(api, "Backend API", "Spring Boot 3.3.1, Java 17", "REST API server. Modular monolith with identity, organisation, app management, form builder, process, and workflow modules.")
        ContainerDb(mongo, "MongoDB Atlas", "MongoDB 7.x", "Stores owner accounts, domain users, organisations, groups, applications, and domain models.")
    }

    Rel(user, spa, "Uses", "HTTPS :4200")
    Rel(spa, api, "Calls REST APIs", "HTTP :8005, JSON + JWT")
    Rel(api, mongo, "Reads/Writes", "MongoDB Driver / TLS")
```

---

## Level 3 — Component Diagram (Backend)

*What modules and shared components make up the Spring Boot API?*

```mermaid
C4Component
    title Component Diagram – Backend API (Spring Boot)

    Container_Boundary(api, "Backend API") {

        Component(security, "Security Layer", "shared.security", "JWT filter, token provider, dual auth (AdaptiveUserDetails + legacy UserDetailsImpl)")
        Component(config, "Config Layer", "shared.config", "CORS, MongoDB, Spring Security filter chain")
        Component(exception, "Exception Handler", "shared.exception", "Global @ControllerAdvice")
        Component(audit, "Auditable", "shared.audit", "Base class for created/updated timestamps")

        Component(identity, "Identity Module", "modules.identity", "Owner signup/login, domain user signup/login, role & password management. Uses OrganisationLookupPort for domain provisioning.")
        Component(organisation, "Organisation Module", "modules.organisation", "Domain CRUD, domain groups, group membership, RBAC permission checks. Exposes OrganisationLookupPort.")
        Component(appMgmt, "App Management Module", "modules.appmanagement", "Application CRUD, app groups, app-level RBAC. Exposes ApplicationLookupPort.")
        Component(formBuilder, "Form Builder Module", "modules.formbuilder", "Domain model (schema) CRUD, model records, model templates, employee model.")
        Component(process, "Process Module", "modules.process", "Process definition lifecycle (draft/publish/archive), process templates, process instance engine.")
        Component(workflow, "Workflow Module", "modules.workflow", "Workflow definition CRUD, workflow instance execution, task management.")
    }

    ContainerDb(mongo, "MongoDB Atlas", "")

    Rel(identity, security, "Issues & validates JWT")
    Rel(identity, organisation, "Provisions domains via OrganisationLookupPort")
    Rel(identity, mongo, "Reads/writes owner_accounts, domain_users, users, roles")
    Rel(organisation, security, "Resolves principal type via PermissionService")
    Rel(organisation, mongo, "Reads/writes organisations, domain_groups, domain_group_members")
    Rel(appMgmt, organisation, "Checks domain permissions via OrganisationLookupPort + PermissionService")
    Rel(appMgmt, mongo, "Reads/writes applications, app_groups, app_group_members")
    Rel(formBuilder, appMgmt, "Validates app access via ApplicationLookupPort + PermissionService")
    Rel(formBuilder, organisation, "Validates domain access via OrganisationLookupPort")
    Rel(formBuilder, mongo, "Reads/writes domain_models, model_records, model_templates")
    Rel(process, appMgmt, "Resolves app via ApplicationLookupPort")
    Rel(process, organisation, "Resolves domain via OrganisationLookupPort")
    Rel(process, mongo, "Reads/writes process_definitions, process_instances, process_templates")
    Rel(workflow, appMgmt, "Resolves app context")
    Rel(workflow, mongo, "Reads/writes workflow_definitions, workflow_instances")
    Rel(config, security, "Configures filter chain")
```

---

## Level 3 — Component Diagram (Frontend)

*What modules make up the Angular SPA?*

```mermaid
C4Component
    title Component Diagram – Frontend SPA (Angular 17)

    Container_Boundary(spa, "Frontend SPA") {

        Component(core, "Core Module", "core/", "Singleton services: AuthService, DomainService, BaseService. Guards: AuthGuard, DomainGuard. Interceptor: AuthInterceptor.")
        Component(shared, "Shared Module", "shared/", "Reusable UI components: NavBar, NaviData, NotFoundPage, RenderForm, ModelRender")
        Component(authFeat, "Auth Feature", "features/auth/", "Login, Owner Signup, Domain Login, Domain Signup pages")
        Component(dashFeat, "Dashboard Feature", "features/dashboard/", "Home page (landing after login)")
        Component(orgFeat, "Organisation Feature", "features/organisation/", "Create domain, domain home, manage members")
        Component(appFeat, "Application Feature", "features/application/", "App home, app models listing")
        Component(fbFeat, "Form Builder Feature", "features/form-builder/", "Model designer, form preview, form data viewer")
    }

    Container(api, "Backend API", "Spring Boot")

    Rel(authFeat, core, "Uses AuthService")
    Rel(dashFeat, core, "Uses AuthService")
    Rel(orgFeat, core, "Uses DomainService")
    Rel(appFeat, core, "Uses DomainService")
    Rel(fbFeat, core, "Uses DomainService")
    Rel(core, api, "HTTP calls via BaseService", "REST + JWT")
    Rel(authFeat, shared, "Imports")
    Rel(dashFeat, shared, "Imports")
    Rel(orgFeat, shared, "Imports")
    Rel(appFeat, shared, "Imports")
    Rel(fbFeat, shared, "Imports")
```

---

## Level 4 — Code Diagram: Identity Module

*Classes and relationships within the identity module.*

```mermaid
classDiagram
    direction TB

    class OwnerAuthController {
        +POST /adaptive/auth/owner/signup
        +POST /adaptive/auth/owner/login
    }

    class DomainAuthController {
        +POST /adaptive/domains/slug/auth/signup
        +POST /adaptive/domains/slug/auth/login
    }

    class AuthController {
        <<legacy>>
        +POST /custom_form/auth/login
        +POST /custom_form/auth/signup
    }

    class UserController {
        <<legacy>>
        +POST /custom_form/user/change-password
        +POST /custom_form/user/roles
    }

    class DomainAssignmentService {
        +assignDomainForUser(user, roles) String
    }

    class AdaptivePrincipalService {
        +loadById(id, type, domainId) Optional~AdaptiveUserDetails~
        +mapOwner(OwnerAccount) AdaptiveUserDetails
        +mapDomainUser(DomainUser) AdaptiveUserDetails
    }

    class OwnerAccount {
        -String id
        -String displayName
        -String email
        -String password
    }

    class DomainUser {
        -String id
        -String domainId
        -String username
        -String email
        -String passwordHash
    }

    class User {
        <<legacy>>
        -String id
        -String username
        -String email
        -String password
        -Set~ObjectId~ roles
        -String domainId
    }

    class Role {
        <<legacy>>
        -String id
        -ERole name
        -String roleName
    }

    class ERole {
        <<enumeration legacy>>
        ROLE_BUSINESS_OWNER
        ROLE_DOMAIN_ADMIN
        ROLE_APP_ADMIN
        ROLE_BUSINESS_USER
    }

    OwnerAuthController --> OwnerAccountRepository
    OwnerAuthController --> JwtTokenProvider
    DomainAuthController --> DomainUserRepository
    DomainAuthController --> OrganisationLookupPort
    DomainAuthController --> JwtTokenProvider
    AuthController --> UserRepository
    AuthController --> RoleRepository
    AuthController --> DomainAssignmentService
    DomainAssignmentService --> OrganisationLookupPort
    AdaptivePrincipalService --> OwnerAccountRepository
    AdaptivePrincipalService --> DomainUserRepository
    OwnerAccountRepository --> OwnerAccount
    DomainUserRepository --> DomainUser
    UserRepository --> User
    RoleRepository --> Role
    Role --> ERole
```

---

## Level 4 — Code Diagram: Organisation Module

*Classes and relationships within the organisation module.*

```mermaid
classDiagram
    direction TB

    class OrganisationLookupPort {
        <<interface>>
        +findBySlug(slug) Optional~Organisation~
        +findByName(name) Optional~Organisation~
        +existsByName(name) boolean
        +createOrganisation(name, ownerUserId) Organisation
    }

    class OrganisationService {
        +findBySlug(slug) Optional~Organisation~
        +findByName(name) Optional~Organisation~
        +existsByName(name) boolean
        +createOrganisation(name, ownerUserId) Organisation
    }

    class OrganisationController {
        +POST /custom_form/domain
        +GET /custom_form/domain
        +GET /custom_form/domain/id
        +GET /custom_form/domain/slug/slug
    }

    class DomainAccessController {
        +GET /adaptive/domains/slug/access/me
    }

    class DomainGroupController {
        +GET /adaptive/domains/slug/groups
        +GET /adaptive/domains/slug/groups/users
        +GET /adaptive/domains/slug/groups/groupId/members
        +POST /adaptive/domains/slug/groups/groupId/members
        +GET /adaptive/domains/slug/groups/users/userId
        +DELETE /adaptive/domains/slug/groups/groupId/members/userId
    }

    class DomainProvisioningService {
        +provisionDefaults(org, ownerUserId) void
        +assignUser(group, userId, assignedBy) void
    }

    class PermissionService {
        +isOwner() boolean
        +hasDomainPermission(domainId, permission) boolean
        +getDomainPermissions(domainId) Set~DomainPermission~
        +hasAppPermission(appId, permission) boolean
    }

    class Organisation {
        -String id
        -String name
        -String slug
        -String ownerUserId
        -String description
        -String industry
        -Map metadata
    }

    class DomainGroup {
        -String id
        -String domainId
        -String name
        -Set~DomainPermission~ permissions
    }

    class DomainGroupMember {
        -String id
        -String groupId
        -String domainId
        -String userId
        -String assignedBy
    }

    class DomainPermission {
        <<enumeration>>
        DOMAIN_ADMIN
        DOMAIN_MANAGE_USERS
        DOMAIN_MANAGE_GROUPS
        DOMAIN_MANAGE_APPS
        DOMAIN_USE_APP
    }

    OrganisationLookupPort <|.. OrganisationService : implements
    OrganisationService --> OrganisationRepository
    OrganisationController --> OrganisationRepository
    OrganisationController --> DomainProvisioningService
    DomainAccessController --> PermissionService
    DomainGroupController --> DomainGroupRepository
    DomainGroupController --> DomainGroupMemberRepository
    DomainGroupController --> PermissionService
    DomainProvisioningService --> DomainGroupRepository
    DomainProvisioningService --> DomainGroupMemberRepository
    PermissionService --> DomainGroupRepository
    PermissionService --> DomainGroupMemberRepository
    OrganisationRepository --> Organisation
    DomainGroupRepository --> DomainGroup
    DomainGroupMemberRepository --> DomainGroupMember
    DomainGroup --> DomainPermission
```

---

## Level 4 — Code Diagram: App Management Module

*Classes and relationships within the app management module.*

```mermaid
classDiagram
    direction TB

    class ApplicationLookupPort {
        <<interface>>
        +findByDomainIdAndSlug(domainId, slug) Optional~Application~
    }

    class ApplicationController {
        +GET /adaptive/domains/slug/apps
        +GET /adaptive/domains/slug/apps/appSlug
        +POST /adaptive/domains/slug/apps
        +DELETE /adaptive/domains/slug/apps/appSlug
        +PATCH /adaptive/domains/slug/apps/appSlug
    }

    class AppGroupController {
        +GET /adaptive/domains/slug/apps/appSlug/groups
        +GET .../groups/users
        +GET .../groups/groupId/members
        +POST .../groups
        +POST .../groups/groupId/members
        +GET .../groups/users/userId
        +DELETE .../groups/groupId/members/userId
    }

    class ApplicationProvisioningService {
        +provisionDefaultGroups(app, ownerUserId, creatorUserId) void
        +assignUser(group, appId, userId, assignedBy) void
    }

    class ApplicationDeletionService {
        +deleteApplication(domainId, app) void
    }

    class Application {
        -String id
        -String domainId
        -String name
        -String slug
        -String ownerUserId
    }

    class AppGroup {
        -String id
        -String appId
        -String name
        -Set~AppPermission~ permissions
    }

    class AppGroupMember {
        -String id
        -String groupId
        -String appId
        -String userId
        -String assignedBy
    }

    class AppPermission {
        <<enumeration>>
        APP_VIEW
        APP_CONFIGURE
        APP_MANAGE_WORKFLOW
        APP_SUBMIT_DATA
    }

    ApplicationController --> OrganisationLookupPort
    ApplicationController --> ApplicationRepository
    ApplicationController --> PermissionService
    ApplicationController --> ApplicationProvisioningService
    ApplicationController --> ApplicationDeletionService
    AppGroupController --> AppGroupRepository
    AppGroupController --> AppGroupMemberRepository
    AppGroupController --> PermissionService
    ApplicationProvisioningService --> AppGroupRepository
    ApplicationProvisioningService --> AppGroupMemberRepository
    ApplicationDeletionService --> ApplicationRepository
    ApplicationDeletionService --> AppGroupRepository
    ApplicationDeletionService --> AppGroupMemberRepository
    ApplicationLookupPort <|.. ApplicationQueryService : implements
    ApplicationQueryService --> ApplicationRepository
    ApplicationRepository --> Application
    AppGroupRepository --> AppGroup
    AppGroupMemberRepository --> AppGroupMember
    AppGroup --> AppPermission
```

---

## Level 4 — Code Diagram: Form Builder Module

*Classes and relationships within the form builder module.*

```mermaid
classDiagram
    direction TB

    class DomainModelController {
        +GET /adaptive/domains/slug/models?appSlug=
        +GET /adaptive/domains/slug/models/modelSlug?appSlug=
        +POST /adaptive/domains/slug/models?appSlug=
        +PUT /adaptive/domains/slug/models/modelSlug?appSlug=
        +DELETE /adaptive/domains/slug/models/modelSlug?appSlug=
        +GET /adaptive/domains/slug/models/templates?appSlug=
        +POST /adaptive/domains/slug/models/from-template?appSlug=
        +GET /adaptive/domains/slug/models/employees
        +GET /adaptive/domains/slug/models/employees/records
    }

    class CustomFormController {
        <<legacy>>
        +GET /custom_form/model/all
        +GET /custom_form/data/all
        +GET /custom_form/model/id
        +GET /custom_form/data/name
        +POST /custom_form/data/add
        +POST /custom_form/model/create
    }

    class ModelRecordService {
        +findAllByModelId(modelId) List~ModelRecord~
        +migrateRecordsForModel(modelId, fields) void
    }

    class DomainModel {
        -String id
        -String domainId
        -String name
        -String slug
        -String description
        -boolean sharedWithAllApps
        -List~String~ allowedAppIds
        -List~DomainModelField~ fields
        -int version
    }

    class ModelRecord {
        -String id
        -String modelId
        -String domainId
        -Map~String,Object~ data
    }

    class ModelTemplate {
        -String id
        -String name
        -String description
        -List~DomainModelField~ fields
    }

    class DomainModelField {
        -String key
        -DomainFieldType type
        -boolean required
        -boolean unique
        -Map~String,Object~ config
    }

    class DomainFieldType {
        <<enumeration>>
        STRING
        NUMBER
        BOOLEAN
        DATE
        DATETIME
        REFERENCE
        OBJECT
        ARRAY
    }

    DomainModelController --> OrganisationLookupPort
    DomainModelController --> ApplicationLookupPort
    DomainModelController --> DomainModelRepository
    DomainModelController --> ModelTemplateRepository
    DomainModelController --> ModelRecordService
    DomainModelController --> PermissionService
    CustomFormController --> CustomFormService
    ModelRecordService --> ModelRecordRepository
    DomainModelRepository --> DomainModel
    ModelTemplateRepository --> ModelTemplate
    ModelRecordRepository --> ModelRecord
    DomainModel --> DomainModelField
    DomainModelField --> DomainFieldType
```

---

## Level 4 — Code Diagram: Security (shared)

*How authentication flows through the security layer.*

```mermaid
classDiagram
    direction TB

    class JwtAuthFilter {
        -JwtTokenProvider jwtTokenProvider
        -UserDetailsServiceImpl userDetailsService
        -AdaptivePrincipalService adaptivePrincipalService
        +doFilterInternal(request, response, chain) void
    }

    class JwtTokenProvider {
        -SecretKey signingKey
        +getJwtFromCookies(request) String
        +generateOwnerJwtCookie(principal) ResponseCookie
        +generateDomainJwtCookie(principal) ResponseCookie
        +generateJwtCookie(userPrincipal) ResponseCookie
        +parseClaims(token) JwtPrincipalClaims
        +getUserNameFromJwtToken(token) String
        +validateJwtToken(token) boolean
    }

    class AdaptiveUserDetails {
        -String id
        -PrincipalType principalType
        -String domainId
        -String username
        -String email
        +owner(id, email, password) AdaptiveUserDetails
        +domainUser(id, domainId, ...) AdaptiveUserDetails
    }

    class UserDetailsImpl {
        <<legacy>>
        -String id
        -String domainId
        -String username
        +build(user, roles) UserDetailsImpl
    }

    class JwtPrincipalClaims {
        -String principalId
        -PrincipalType principalType
        -String domainId
        -String username
    }

    class PrincipalType {
        <<enumeration>>
        OWNER
        DOMAIN_USER
    }

    class WebSecurityConfig {
        +securityFilterChain(http) SecurityFilterChain
        +authenticationManager() AuthenticationManager
    }

    WebSecurityConfig --> JwtAuthFilter : registers
    JwtAuthFilter --> JwtTokenProvider : validates token
    JwtAuthFilter --> AdaptivePrincipalService : resolves adaptive principal
    JwtAuthFilter --> UserDetailsServiceImpl : resolves legacy principal
    JwtTokenProvider --> JwtPrincipalClaims : parses claims
    AdaptiveUserDetails --> PrincipalType
    JwtPrincipalClaims --> PrincipalType
```

---

## Deployment Diagram

*Current development deployment topology.*

```mermaid
C4Deployment
    title Deployment Diagram – AdaptiveBP (Development)

    Deployment_Node(dev, "Developer Machine", "Windows / macOS / Linux") {
        Deployment_Node(ng, "Angular CLI Dev Server", ":4200") {
            Container(spa, "Frontend SPA", "Angular 17", "ng serve --configuration development")
        }
        Deployment_Node(jvm, "JVM 17", ":8005") {
            Container(api, "Backend API", "Spring Boot 3.3.1", "java -jar api-0.0.1-SNAPSHOT.jar")
        }
    }

    Deployment_Node(cloud, "MongoDB Atlas", "Cloud") {
        ContainerDb(mongo, "MongoDB Cluster", "MongoDB 7.x", "Shared/Dedicated cluster")
    }

    Rel(spa, api, "REST API calls", "HTTP :8005")
    Rel(api, mongo, "MongoDB driver", "TLS")
```

---

## API Request Flow (Sequence)

*Typical authenticated request lifecycle.*

```mermaid
sequenceDiagram
    participant B as Browser (Angular)
    participant API as Spring Boot API
    participant Filter as JwtAuthFilter
    participant JWT as JwtTokenProvider
    participant Svc as AdaptivePrincipalService
    participant Ctrl as Controller
    participant Perm as PermissionService
    participant Repo as Repository
    participant DB as MongoDB Atlas

    B->>API: POST /adaptive/domains/acme/apps (JWT cookie)
    API->>Filter: doFilterInternal()
    Filter->>JWT: getJwtFromCookies()
    JWT-->>Filter: token string
    Filter->>JWT: validateJwtToken(token)
    JWT-->>Filter: true
    Filter->>JWT: parseClaims(token)
    JWT-->>Filter: {pid, ptype=OWNER, domainId}
    Filter->>Svc: loadById(pid, OWNER, domainId)
    Svc-->>Filter: AdaptiveUserDetails
    Filter->>Filter: Set SecurityContext
    API->>Ctrl: ApplicationController.create()
    Ctrl->>Perm: hasDomainPermission(domainId, MANAGE_APPS)
    Perm-->>Ctrl: true (OWNER → all permissions)
    Ctrl->>Repo: applicationRepository.save(app)
    Repo->>DB: insertOne()
    DB-->>Repo: ack
    Ctrl->>Ctrl: ApplicationProvisioningService.provisionDefaultGroups()
    Ctrl-->>B: 201 Created {application}
```

---

## Data Model (Entity Relationship)

*MongoDB collections and their logical relationships.*

```mermaid
erDiagram
    OwnerAccount ||--o{ Organisation : "creates"
    Organisation ||--o{ DomainUser : "contains"
    Organisation ||--o{ DomainGroup : "has"
    Organisation ||--o{ Application : "contains"
    DomainGroup ||--o{ DomainGroupMember : "has"
    DomainUser ||--o{ DomainGroupMember : "belongs to"
    Application ||--o{ AppGroup : "has"
    AppGroup ||--o{ AppGroupMember : "has"
    DomainUser ||--o{ AppGroupMember : "belongs to"
    Organisation ||--o{ DomainModel : "owns"
    Application ||--o{ DomainModel : "scoped to (optional)"

    OwnerAccount {
        string id PK
        string displayName
        string email UK
        string password
    }

    Organisation {
        string id PK
        string name
        string slug UK
        string ownerId FK
        string description
        string industry
    }

    DomainUser {
        string id PK
        string domainId FK
        string username
        string email
        string password
    }

    DomainGroup {
        string id PK
        string domainId FK
        string name
        string[] permissions
    }

    DomainGroupMember {
        string id PK
        string groupId FK
        string domainId FK
        string userId FK
        string assignedBy
    }

    Application {
        string id PK
        string domainId FK
        string name
        string slug
        string ownerUserId FK
    }

    AppGroup {
        string id PK
        string appId FK
        string name
        string[] permissions
    }

    AppGroupMember {
        string id PK
        string groupId FK
        string appId FK
        string userId FK
        string assignedBy
    }

    DomainModel {
        string id PK
        string domainId FK
        string name
        string slug
        string description
        boolean sharedWithAllApps
        string[] allowedAppIds
        DomainModelField[] fields
    }
```
