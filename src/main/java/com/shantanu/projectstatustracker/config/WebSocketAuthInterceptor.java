package com.shantanu.projectstatustracker.config;

import com.shantanu.projectstatustracker.services.JwtService;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {

        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        assert accessor != null;
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {

            String token = accessor.getFirstNativeHeader("Authorization");

            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);

                String username = jwtService.extractEmail(token);

                UserDetails user =
                        userDetailsService.loadUserByUsername(username);

                accessor.setUser(new UsernamePasswordAuthenticationToken(
                        user, null, user.getAuthorities()));
            }
        }

        return message;
    }

}

