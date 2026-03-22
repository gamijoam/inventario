namespace InvensoftDesktop.Models;

public class AppSettings
{
    public string ServerUrl { get; set; } = "https://api.miinventariofacil.com";
    public string TenantSlug { get; set; } = "";
    public string SavedUsername { get; set; } = "";
    public string Token { get; set; } = "";

    public bool IsLoggedIn => !string.IsNullOrWhiteSpace(Token);
}
