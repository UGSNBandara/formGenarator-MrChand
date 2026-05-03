package com.adaptivebp.modules.organisation.port;

import java.util.Optional;

import com.adaptivebp.modules.organisation.model.Organisation;

/**
 * Public API that the organisation module exposes for lookups and provisioning.
 * Other modules must depend on this interface — never on OrganisationRepository directly.
 */
public interface OrganisationLookupPort {
    Optional<Organisation> findBySlug(String slug);

    Optional<Organisation> findByName(String name);

    boolean existsByName(String name);

    /**
     * Creates and persists a new Organisation.
     * Used by the identity module during signup to provision a domain for Business Owners.
     */
    Organisation createOrganisation(String name, String ownerUserId);
}
