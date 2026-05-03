package com.adaptivebp.shared.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.adaptivebp.shared.security.UserDetailsServiceImpl;
import com.adaptivebp.shared.security.AuthEntryPoint;
import com.adaptivebp.shared.security.JwtAuthFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(securedEnabled = true, jsr250Enabled = true)
public class WebSecurityConfig {

	@Autowired
	UserDetailsServiceImpl userDetailsService;

	@Autowired
	private AuthEntryPoint unauthorizedHandler;

	@Bean
	public JwtAuthFilter authenticationJwtTokenFilter() {
		return new JwtAuthFilter();
	}

	@Bean
	public UserDetailsService userDetailsService(BCryptPasswordEncoder bCryptPasswordEncoder) {
		return userDetailsService;
	}

	@Bean
	public BCryptPasswordEncoder getBCryptPasswordEncoderpasswordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
	http
		.cors();
	http.csrf(csrf -> csrf.disable())
				.exceptionHandling(ex -> ex.authenticationEntryPoint(unauthorizedHandler))
				.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
					.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers("/error").permitAll()
						.requestMatchers("/custom_form/auth/**").permitAll()
						.requestMatchers("/adaptive/auth/**").permitAll()
						.requestMatchers("/adaptive/domains/*/auth/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/adaptive/domains/*/branding").permitAll()
						.requestMatchers("/adaptive/**").authenticated()
						.requestMatchers("/custom_form/model/**").hasAnyAuthority("APP_ADMIN", "DOMAIN_ADMIN", "BUSINESS_OWNER")
						.requestMatchers("/custom_form/data/**").hasAnyAuthority("APP_ADMIN", "DOMAIN_ADMIN", "BUSINESS_OWNER", "BUSINESS_USER")
						.requestMatchers("/custom_form/**").authenticated()
						.anyRequest().denyAll())
				.formLogin(form -> form.disable())
				.httpBasic(basic -> basic.disable());

		http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);
		http.authenticationProvider(daoAuthenticationProvider());
		return http.build();
	}

	@Bean
	public AuthenticationManager authenticationManager() {
		return new ProviderManager(daoAuthenticationProvider());
	}

	@Bean
	public DaoAuthenticationProvider daoAuthenticationProvider() {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
		provider.setUserDetailsService(userDetailsService);
		provider.setPasswordEncoder(getBCryptPasswordEncoderpasswordEncoder());
		return provider;
	}
}
