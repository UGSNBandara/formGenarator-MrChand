package com.adaptivebp.modules.identity.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.adaptivebp.modules.identity.dto.request.DomainLoginRequest;
import com.adaptivebp.modules.identity.dto.request.DomainSignupRequest;
import com.adaptivebp.modules.identity.dto.response.AuthResponse;
import com.adaptivebp.modules.identity.model.DomainUser;
import com.adaptivebp.modules.identity.repository.DomainUserRepository;
import com.adaptivebp.modules.organisation.model.Organisation;
import com.adaptivebp.modules.organisation.port.OrganisationLookupPort;
import com.adaptivebp.shared.security.AdaptiveUserDetails;
import com.adaptivebp.shared.security.JwtTokenProvider;
import com.adaptivebp.shared.security.PrincipalType;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/adaptive/domains/{slug}/auth")
public class DomainAuthController {

    @Autowired
    private OrganisationLookupPort organisationLookupPort;

    @Autowired
    private DomainUserRepository domainUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@PathVariable String slug, @Valid @RequestBody DomainSignupRequest request) {
        Organisation domain = organisationLookupPort.findBySlug(slugify(slug)).orElse(null);
        if (domain == null) {
            return ResponseEntity.notFound().build();
        }
        if (domainUserRepository.findByDomainIdAndUsername(domain.getId(), request.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("Username already exists in this domain");
        }
        if (domainUserRepository.findByDomainIdAndEmail(domain.getId(), request.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists in this domain");
        }
        DomainUser user = new DomainUser();
        user.setDomainId(domain.getId());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setStatus("ACTIVE");
        domainUserRepository.save(user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@PathVariable String slug, @Valid @RequestBody DomainLoginRequest request) {
        Organisation domain = organisationLookupPort.findBySlug(slugify(slug)).orElse(null);
        if (domain == null) {
            return ResponseEntity.status(404).body("Domain not found");
        }
        return domainUserRepository.findByDomainIdAndUsername(domain.getId(), request.getUsername())
                .map(user -> {
                    if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
                        return ResponseEntity.status(401).body("Invalid credentials");
                    }
                    return buildDomainLoginResponse(user, domain);
                })
                .orElseGet(() -> ResponseEntity.status(401).body("Invalid credentials"));
    }

    private ResponseEntity<AuthResponse> buildDomainLoginResponse(DomainUser user, Organisation domain) {
        AdaptiveUserDetails principal = AdaptiveUserDetails.domainUser(user.getId(), domain.getId(),
                user.getUsername(), user.getEmail(), user.getPasswordHash());
        ResponseCookie cookie = jwtTokenProvider.generateDomainJwtCookie(principal);
        AuthResponse response = new AuthResponse(user.getId(), domain.getId(), PrincipalType.DOMAIN_USER,
                cookie.getValue());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(response);
    }

    private String slugify(String input) {
        if (input == null) return null;
        String s = input.trim().toLowerCase();
        s = s.replaceAll("[^a-z0-9]+", "-");
        s = s.replaceAll("^-+", "").replaceAll("-+$", "");
        return s;
    }
}
