package com.adaptivebp.modules.identity.service;

import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.adaptivebp.modules.identity.model.ERole;
import com.adaptivebp.modules.identity.model.Role;
import com.adaptivebp.modules.identity.model.User;
import com.adaptivebp.modules.organisation.model.Organisation;
import com.adaptivebp.modules.organisation.port.OrganisationLookupPort;

/**
 * Handles domain provisioning for newly registered users.
 * <p>
 * Business Owners get a new, dedicated domain.
 * All other users are assigned to the shared "global" domain.
 * <p>
 * Uses {@link OrganisationLookupPort} to interact with the organisation module —
 * never accesses OrganisationRepository directly (Rule 1 & 2).
 */
@Service
public class DomainAssignmentService {

    @Autowired
    private OrganisationLookupPort organisationLookupPort;

    /**
     * Assigns an appropriate domain to the given user based on their roles.
     *
     * @param savedUser the persisted user (must have an id)
     * @param roles     the resolved set of Role entities
     * @return the domain ID assigned to the user
     */
    public String assignDomainForUser(User savedUser, Set<Role> roles) {
        boolean isBusinessOwner = roles.stream().anyMatch(r ->
                ("BUSINESS_OWNER".equalsIgnoreCase(r.getRoleName())) || r.getName() == ERole.ROLE_BUSINESS_OWNER);

        if (isBusinessOwner) {
            return provisionNewDomain(savedUser);
        } else {
            return getOrCreateGlobalDomain(savedUser.getId());
        }
    }

    private String provisionNewDomain(User savedUser) {
        String baseName = savedUser.getUsername() != null ? savedUser.getUsername().toLowerCase() : "domain";
        String name = baseName;
        if (organisationLookupPort.existsByName(name)) {
            name = baseName + "-" + savedUser.getId().substring(0, Math.min(6, savedUser.getId().length()));
        }
        Organisation created = organisationLookupPort.createOrganisation(name, savedUser.getId());
        return created.getId();
    }

    private String getOrCreateGlobalDomain(String userId) {
        return organisationLookupPort.findByName("global")
                .map(Organisation::getId)
                .orElseGet(() -> {
                    Organisation global = organisationLookupPort.createOrganisation("global", userId);
                    return global.getId();
                });
    }
}
