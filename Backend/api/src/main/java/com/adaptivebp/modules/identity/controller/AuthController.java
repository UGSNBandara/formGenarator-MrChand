package com.adaptivebp.modules.identity.controller;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.adaptivebp.modules.identity.dto.request.LoginRequest;
import com.adaptivebp.modules.identity.dto.request.SignupRequest;
import com.adaptivebp.modules.identity.dto.response.MessageResponse;
import com.adaptivebp.modules.identity.dto.response.UserInfoResponse;
import com.adaptivebp.modules.identity.model.ERole;
import com.adaptivebp.modules.identity.model.Role;
import com.adaptivebp.modules.identity.model.User;
import com.adaptivebp.modules.identity.repository.RoleRepository;
import com.adaptivebp.modules.identity.repository.UserRepository;
import com.adaptivebp.modules.identity.service.DomainAssignmentService;
import com.adaptivebp.shared.security.JwtTokenProvider;
import com.adaptivebp.shared.security.UserDetailsImpl;

import org.bson.types.ObjectId;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/custom_form/auth")
public class AuthController {
	@Autowired
	AuthenticationManager authenticationManager;
	@Autowired
	UserRepository userRepository;
	@Autowired
	RoleRepository roleRepository;
	@Autowired
	DomainAssignmentService domainAssignmentService;
	@Autowired
	PasswordEncoder encoder;
	@Autowired
	JwtTokenProvider jwtTokenProvider;

	@PostMapping("/login")
	public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
		Authentication authentication = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));
		SecurityContextHolder.getContext().setAuthentication(authentication);
		UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
		if (userDetails.getDomainId() == null || userDetails.getDomainId().isBlank()) {
			return ResponseEntity.badRequest().body(new MessageResponse("Error: User has no domain assigned."));
		}
		ResponseCookie jwtCookie = jwtTokenProvider.generateJwtCookie(userDetails);
		List<String> roles = userDetails.getAuthorities().stream().map(item -> item.getAuthority())
				.collect(Collectors.toList());

		return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, jwtCookie.toString()).body(new UserInfoResponse(
				userDetails.getId(), userDetails.getDomainId(), userDetails.getUsername(), userDetails.getEmail(), roles, jwtCookie.getValue()));
	}

	@PostMapping("/signup")
	public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
		if (userRepository.existsByUsername(signUpRequest.getUsername())) {
			return ResponseEntity.badRequest().body(new MessageResponse("Error: Username is already taken!"));
		}
		if (userRepository.existsByEmail(signUpRequest.getEmail())) {
			return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is already in use!"));
		}
		User user = new User(signUpRequest.getUsername(), signUpRequest.getEmail(),
				encoder.encode(signUpRequest.getPassword()));
		Set<String> strRoles = signUpRequest.getRoles();
		Set<Role> roles = new HashSet<>();
		if (strRoles == null) {
			Role defaultRole = roleRepository.findByRoleName("BUSINESS_USER")
					.orElseGet(() -> roleRepository.findByName(ERole.ROLE_BUSINESS_USER)
							.orElseThrow(() -> new RuntimeException("Error: Default role is not found.")));
			roles.add(defaultRole);
		} else {
			strRoles.forEach(role -> {
				switch (role) {
				case "BUSINESS_OWNER":
					Role businessOwnerRole = roleRepository.findByRoleName("BUSINESS_OWNER")
							.orElseGet(() -> roleRepository.findByName(ERole.ROLE_BUSINESS_OWNER)
									.orElseThrow(() -> new RuntimeException("Error: Role is not found.")));
					roles.add(businessOwnerRole);
					break;
				case "DOMAIN_ADMIN":
				case "admin":
					Role domainAdminRole = roleRepository.findByRoleName("DOMAIN_ADMIN")
							.orElseGet(() -> roleRepository.findByName(ERole.ROLE_DOMAIN_ADMIN)
									.orElseThrow(() -> new RuntimeException("Error: Role is not found.")));
					roles.add(domainAdminRole);
					break;
				case "APP_ADMIN":
					Role appAdminRole = roleRepository.findByRoleName("APP_ADMIN")
							.orElseGet(() -> roleRepository.findByName(ERole.ROLE_APP_ADMIN)
									.orElseThrow(() -> new RuntimeException("Error: Role is not found.")));
					roles.add(appAdminRole);
					break;
				case "BUSINESS_USER":
				case "user":
				default:
					Role businessUserRole = roleRepository.findByRoleName("BUSINESS_USER")
							.orElseGet(() -> roleRepository.findByName(ERole.ROLE_BUSINESS_USER)
									.orElseThrow(() -> new RuntimeException("Error: Role is not found.")));
					roles.add(businessUserRole);
				}
			});
		}
		Set<ObjectId> roleIds = roles.stream().map(r -> new ObjectId(r.getId())).collect(Collectors.toSet());
		user.setRoles(roleIds);
		User saved = userRepository.save(user);
		String domainId = domainAssignmentService.assignDomainForUser(saved, roles);
		saved.setDomainId(domainId);
		userRepository.save(saved);
		return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
	}
}

