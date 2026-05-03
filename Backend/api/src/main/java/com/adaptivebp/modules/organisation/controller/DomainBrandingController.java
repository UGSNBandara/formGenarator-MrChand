package com.adaptivebp.modules.organisation.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.adaptivebp.modules.organisation.model.Organisation;
import com.adaptivebp.modules.organisation.repository.OrganisationRepository;
import com.adaptivebp.shared.security.AdaptiveUserDetails;
import com.adaptivebp.shared.security.PrincipalType;

/**
 * Manages domain branding/customization settings.
 * Branding data is stored inside Organisation.metadata["branding"].
 *
 * GET  /adaptive/domains/{slug}/branding — Public (so unauthenticated users see branded login pages)
 * PATCH /adaptive/domains/{slug}/branding — Protected (only owner or DOMAIN_MANAGE permission)
 */
@RestController
@RequestMapping("/adaptive/domains/{slug}/branding")
public class DomainBrandingController {

    @Autowired
    private OrganisationRepository organisationRepository;

    /**
     * Get branding settings for a domain. Public endpoint.
     */
    @GetMapping
    public ResponseEntity<?> getBranding(@PathVariable String slug) {
        Organisation org = requireDomain(slug);
        Map<String, Object> metadata = org.getMetadata();
        Object branding = metadata != null ? metadata.getOrDefault("branding", new HashMap<>()) : new HashMap<>();
        return ResponseEntity.ok(branding);
    }

    /**
     * Update branding settings. Requires owner or DOMAIN_MANAGE permission.
     */
    @SuppressWarnings("unchecked")
    @PatchMapping
    public ResponseEntity<?> updateBranding(
            @PathVariable String slug,
            @RequestBody Map<String, Object> branding) {

        Organisation org = requireDomain(slug);

        // Auth check: only owner or domain admin
        AdaptiveUserDetails principal = currentPrincipal();
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean isOwner = principal.getPrincipalType() == PrincipalType.OWNER
                && org.getOwnerUserId().equals(principal.getId());

        if (!isOwner) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only the domain owner can update branding settings.");
        }

        // Extract and save description directly on the Organisation entity
        Object descriptionValue = branding.remove("description");
        if (descriptionValue instanceof String) {
            org.setDescription((String) descriptionValue);
        }

        // Merge branding into metadata
        Map<String, Object> metadata = org.getMetadata();
        if (metadata == null) {
            metadata = new HashMap<>();
        }

        // Get existing branding and merge (so partial updates work)
        Map<String, Object> existingBranding = new HashMap<>();
        Object existing = metadata.get("branding");
        if (existing instanceof Map) {
            existingBranding.putAll((Map<String, Object>) existing);
        }
        existingBranding.putAll(branding);

        metadata.put("branding", existingBranding);
        org.setMetadata(metadata);
        organisationRepository.save(org);

        return ResponseEntity.ok(existingBranding);
    }

    private Organisation requireDomain(String slug) {
        String normalizedSlug = slugify(slug);
        return organisationRepository.findBySlug(normalizedSlug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Domain not found"));
    }

    private AdaptiveUserDetails currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AdaptiveUserDetails details) {
            return details;
        }
        return null;
    }

    private String slugify(String input) {
        if (input == null) return null;
        String s = input.trim().toLowerCase();
        s = s.replaceAll("[^a-z0-9]+", "-");
        s = s.replaceAll("^-+", "").replaceAll("-+$", "");
        return s;
    }
}
