namespace InvensoftDesktop.Models;

public enum AppMode
{
    Cloud,  // Conecta a SaaS en la nube
    Local   // Conecta a backend corriendo en esta misma PC
}

public class AppSettings
{
    public AppMode Mode { get; set; } = AppMode.Cloud;

    // Cloud mode
    public string ServerUrl { get; set; } = "https://api.miinventariofacil.com";
    public string TenantSlug { get; set; } = "";

    // Local mode — la URL es siempre localhost, el tenant se configura en setup
    public string LocalPort { get; set; } = "8000";
    public string LocalTenantSlug { get; set; } = "local";

    public string SavedUsername { get; set; } = "";
    public string Token { get; set; } = "";

    // Derived helpers
    public bool IsLoggedIn => !string.IsNullOrWhiteSpace(Token);
    public bool IsLocalMode => Mode == AppMode.Local;
    public bool IsCloudMode => Mode == AppMode.Cloud;

    public string EffectiveServerUrl => IsLocalMode
        ? $"http://localhost:{LocalPort}"
        : ServerUrl;

    public string EffectiveTenantSlug => IsLocalMode
        ? LocalTenantSlug
        : TenantSlug;
}
