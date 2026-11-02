package com.nexus.app.core.network

object ApiEndpoints {
    // Android emulator loopback alias to host machine's localhost:3001
    const val DEFAULT_BASE_URL = "http://10.0.2.2:3001"

    // Auth
    const val AUTH_LOGIN = "/api/auth/login"
    const val AUTH_REGISTER = "/api/auth/register"
    const val AUTH_REFRESH = "/api/auth/refresh"
    const val AUTH_LOGOUT = "/api/auth/logout"
    const val AUTH_PROFILE = "/api/auth/profile"
    const val AUTH_PROFILE_IMAGES = "/api/auth/profile/images"
    const val AUTH_CHANGE_PASSWORD = "/api/auth/change-password"

    // Client Services
    const val CLIENT_SERVICES = "/api/client/services"
    fun clientServiceDetails(id: String) = "/api/client/services/$id"
    fun clientServiceSpecialists(id: String) = "/api/client/services/$id/specialists"

    // Client Service Requests
    const val CLIENT_SERVICE_REQUESTS = "/api/client/service-requests"
    fun cancelServiceRequest(id: String) = "/api/client/service-requests/$id/cancel"

    // Request Conversations & Chat
    const val CONVERSATIONS = "/api/request-conversations"
    fun conversationMessages(id: String) = "/api/request-conversations/$id"
    fun sendConversationMessage(id: String) = "/api/request-conversations/$id/messages"
    fun markConversationRead(id: String) = "/api/request-conversations/$id/read"
    fun conversationStream(id: String) = "/api/request-conversations/$id/stream"

    // Projects
    fun projectWorkspace(id: String) = "/api/projects/$id"

    // System Health
    const val HEALTH = "/api/health"
}

