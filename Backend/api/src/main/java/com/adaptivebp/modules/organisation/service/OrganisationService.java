package com.adaptivebp.modules.organisation.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.adaptivebp.modules.organisation.model.Organisation;
import com.adaptivebp.modules.organisation.port.OrganisationLookupPort;
import com.adaptivebp.modules.organisation.repository.OrganisationRepository;

/**
 * Implements OrganisationLookupPort — the public API for the organisation module.
 * Wraps OrganisationRepository so that cross-module callers never import the repo directly.
 */
@Service
public class OrganisationService implements OrganisationLookupPort {

    @Autowired
    private OrganisationRepository organisationRepository;

    @Override
    public Optional<Organisation> findBySlug(String slug) {
        return organisationRepository.findBySlug(slug);
    }

    @Override
    public Optional<Organisation> findByName(String name) {
        return organisationRepository.findByName(name);
    }

    @Override
    public boolean existsByName(String name) {
        return organisationRepository.existsByName(name);
    }

    @Override
    public Organisation createOrganisation(String name, String ownerUserId) {
        Organisation organisation = new Organisation(name, ownerUserId);
        return organisationRepository.save(organisation);
    }
}
