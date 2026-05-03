package com.adaptivebp.modules.identity.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.adaptivebp.modules.identity.dto.request.DomainLoginRequest;
import com.adaptivebp.modules.identity.model.DomainUser;
import com.adaptivebp.modules.organisation.port.OrganisationLookupPort;
import com.adaptivebp.modules.identity.repository.DomainUserRepository;
import com.adaptivebp.modules.organisation.model.Organisation;
import com.adaptivebp.shared.security.JwtTokenProvider;

@ExtendWith(MockitoExtension.class)
class DomainAuthControllerTest {

    @Mock
    private OrganisationLookupPort organisationLookupPort;

    @Mock
    private DomainUserRepository domainUserRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private DomainAuthController controller;

    private Organisation organisation;
    private DomainUser domainUser;

    @BeforeEach
    void setup() {
        organisation = new Organisation("Acme", "acme", "owner-1");
        organisation.setId("domain-1");
        domainUser = new DomainUser();
        domainUser.setId("user-1");
        domainUser.setDomainId(organisation.getId());
        domainUser.setUsername("alice");
        domainUser.setEmail("alice@acme.com");
        domainUser.setPasswordHash("hash");
    }

    @Test
    void login_shouldReturnToken_whenCredentialsValid() {
        DomainLoginRequest request = new DomainLoginRequest();
        request.setUsername("alice");
        request.setPassword("secret");

        when(organisationLookupPort.findBySlug("acme")).thenReturn(Optional.of(organisation));
        when(domainUserRepository.findByDomainIdAndUsername(organisation.getId(), request.getUsername()))
                .thenReturn(Optional.of(domainUser));
        when(passwordEncoder.matches(request.getPassword(), domainUser.getPasswordHash())).thenReturn(true);
        ResponseCookie cookie = ResponseCookie.from("token", "xyz").build();
        when(jwtTokenProvider.generateDomainJwtCookie(any())).thenReturn(cookie);

        ResponseEntity<?> response = controller.login("acme", request);

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE).contains("token=xyz"));
    }

    @Test
    void login_shouldFail_whenDomainMissing() {
        when(organisationLookupPort.findBySlug("acme")).thenReturn(Optional.empty());
        DomainLoginRequest request = new DomainLoginRequest();
        request.setUsername("any");
        request.setPassword("pw");

        ResponseEntity<?> response = controller.login("acme", request);

        assertEquals(404, response.getStatusCode().value());
    }
}
