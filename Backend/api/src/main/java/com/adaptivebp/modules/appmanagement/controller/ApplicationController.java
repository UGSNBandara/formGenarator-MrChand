package com.adaptivebp.modules.appmanagement.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.adaptivebp.modules.appmanagement.dto.request.CreateApplicationRequest;
import com.adaptivebp.modules.appmanagement.model.Application;
import com.adaptivebp.modules.appmanagement.permission.AppPermission;
import com.adaptivebp.modules.appmanagement.repository.ApplicationRepository;
import com.adaptivebp.modules.appmanagement.service.ApplicationProvisioningService;
import com.adaptivebp.modules.appmanagement.service.ApplicationDeletionService;
import com.adaptivebp.modules.organisation.model.Organisation;
import com.adaptivebp.modules.organisation.permission.DomainPermission;
import com.adaptivebp.modules.organisation.port.OrganisationLookupPort;
import com.adaptivebp.modules.organisation.service.PermissionService;
import com.adaptivebp.shared.security.AdaptiveUserDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/adaptive/domains/{slug}/apps")
public class ApplicationController {

    @Autowired
    private OrganisationLookupPort organisationLookupPort;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private PermissionService permissionService;

    @Autowired
    private ApplicationProvisioningService applicationProvisioningService;

    @Autowired
    private ApplicationDeletionService applicationDeletionService;

    @GetMapping
    public ResponseEntity<?> list(@PathVariable String slug) {
        Organisation domain = requireDomain(slug);
        String currentUserId = currentPrincipalId();
        List<Application> apps = applicationRepository.findByDomainId(domain.getId()).stream()
            .filter(app -> canViewApp(app, currentUserId))
                .toList();
        return ResponseEntity.ok(apps);
    }

    @GetMapping("/{appSlug}")
    public ResponseEntity<?> getApplication(@PathVariable String slug, @PathVariable String appSlug) {
        Organisation domain = requireDomain(slug);
        Application app = applicationRepository.findByDomainIdAndSlug(domain.getId(), appSlug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        if (!canViewApp(app, currentPrincipalId())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(app);
    }

    @PostMapping
    public ResponseEntity<?> create(@PathVariable String slug, @Valid @RequestBody CreateApplicationRequest request) {
        Organisation domain = requireDomain(slug);
        if (!permissionService.hasDomainPermission(domain.getId(), DomainPermission.DOMAIN_MANAGE_APPS)) {
            return ResponseEntity.status(403).build();
        }
        if (applicationRepository.existsByDomainIdAndSlug(domain.getId(), request.getSlug())) {
            return ResponseEntity.badRequest().body("Slug already exists");
        }
        Application application = new Application();
        application.setDomainId(domain.getId());
        application.setSlug(request.getSlug());
        application.setName(request.getName());
        String creatorUserId = currentPrincipalId();
        String requestedOwnerUserId = normalizeUserId(request.getOwnerUserId());
        String effectiveOwnerUserId = requestedOwnerUserId != null ? requestedOwnerUserId : creatorUserId;
        application.setOwnerUserId(effectiveOwnerUserId);
        Application saved = applicationRepository.save(application);
        applicationProvisioningService.provisionDefaultGroups(saved, effectiveOwnerUserId, creatorUserId);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{appSlug}")
    public ResponseEntity<?> delete(@PathVariable String slug, @PathVariable String appSlug) {
        Organisation domain = requireDomain(slug);
        Application app = applicationRepository.findByDomainIdAndSlug(domain.getId(), appSlug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        if (!permissionService.hasAppPermission(app.getId(), AppPermission.APP_CONFIGURE)) {
            return ResponseEntity.status(403).build();
        }
        applicationDeletionService.deleteApplication(domain.getId(), app);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{appSlug}/branding")
    public ResponseEntity<?> updateBranding(
            @PathVariable String slug,
            @PathVariable String appSlug,
            @RequestBody java.util.Map<String, Object> branding) {
        
        Organisation domain = requireDomain(slug);
        Application app = applicationRepository.findByDomainIdAndSlug(domain.getId(), appSlug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        
        // Ensure user has configure permission
        if (!permissionService.hasAppPermission(app.getId(), AppPermission.APP_CONFIGURE)) {
            // Also allow domain owner
            String currentUserId = currentPrincipalId();
            boolean isOwner = currentUserId != null && currentUserId.equals(domain.getOwnerUserId());
            if (!isOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only app admins can update app settings.");
            }
        }

        java.util.Map<String, Object> metadata = app.getMetadata();
        if (metadata == null) {
            metadata = new java.util.HashMap<>();
        }

        java.util.Map<String, Object> existingBranding = new java.util.HashMap<>();
        Object existing = metadata.get("branding");
        if (existing instanceof java.util.Map) {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> existingMap = (java.util.Map<String, Object>) existing;
            existingBranding.putAll(existingMap);
        }
        existingBranding.putAll(branding);

        metadata.put("branding", existingBranding);
        app.setMetadata(metadata);
        applicationRepository.save(app);

        return ResponseEntity.ok(existingBranding);
    }

    private Organisation requireDomain(String slug) {
        return organisationLookupPort.findBySlug(slugify(slug))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Domain not found"));
    }

    private String slugify(String input) {
        if (input == null) return null;
        String s = input.trim().toLowerCase();
        s = s.replaceAll("[^a-z0-9]+", "-");
        s = s.replaceAll("^-+", "").replaceAll("-+$", "");
        return s;
    }

    private boolean canViewApp(Application app, String currentUserId) {
        if (permissionService.hasAppPermission(app.getId(), AppPermission.APP_VIEW)) {
            return true;
        }
        return currentUserId != null && currentUserId.equals(app.getOwnerUserId());
    }

    private String currentPrincipalId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdaptiveUserDetails details) {
            return details.getId();
        }
        return null;
    }

    private String normalizeUserId(String userId) {
        if (userId == null) {
            return null;
        }
        String normalized = userId.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
