using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Auth;

public class TokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = "";

    [JsonPropertyName("token_type")]
    public string TokenType { get; set; } = "bearer";

    [JsonPropertyName("tenant_slug")]
    public string TenantSlug { get; set; } = "";
}
