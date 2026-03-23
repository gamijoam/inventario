namespace InvensoftDesktop.Models;

public class AppSettings
{
    // Dónde está el backend (ej: http://localhost:8000 o http://192.168.1.10:8000)
    public string ServerUrl  { get; set; } = "http://localhost:8000";

    // Schema/slug del tenant (ej: ferreteria_demo)
    public string TenantSlug { get; set; } = "";

    public string SavedUsername { get; set; } = "";
    public string Token         { get; set; } = "";

    public bool IsLoggedIn => !string.IsNullOrWhiteSpace(Token);
}
