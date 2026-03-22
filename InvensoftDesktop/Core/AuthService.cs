using System.Text.Json;
using InvensoftDesktop.Models.Auth;

namespace InvensoftDesktop.Core;

public class AuthService
{
    private readonly SettingsManager _settings;
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public AuthService(SettingsManager settings, IHttpClientFactory factory)
    {
        _settings = settings;
        _http = factory.CreateClient();
    }

    public bool IsLoggedIn => _settings.Settings.IsLoggedIn;

    public async Task<(bool Success, string Error)> LoginAsync(
        string serverUrl, string tenant, string username, string password)
    {
        try
        {
            var url = $"{serverUrl.TrimEnd('/')}/api/v1/auth/token";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("x-tenant-id", tenant);
            request.Content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("username", username),
                new KeyValuePair<string, string>("password", password),
            });

            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                return (false, response.StatusCode == System.Net.HttpStatusCode.Unauthorized
                    ? "Usuario o contraseña incorrectos."
                    : $"Error del servidor: {(int)response.StatusCode}");
            }

            var json = await response.Content.ReadAsStringAsync();
            var token = JsonSerializer.Deserialize<TokenResponse>(json, JsonOpts);

            if (token == null || string.IsNullOrEmpty(token.AccessToken))
                return (false, "Respuesta inválida del servidor.");

            _settings.Settings.ServerUrl = serverUrl;
            _settings.Settings.TenantSlug = tenant;
            _settings.Settings.SavedUsername = username;
            _settings.Settings.Token = token.AccessToken;
            _settings.Save();

            return (true, "");
        }
        catch (HttpRequestException)
        {
            return (false, "No se pudo conectar al servidor. Verifica la URL.");
        }
        catch (Exception ex)
        {
            return (false, $"Error inesperado: {ex.Message}");
        }
    }

    public void Logout()
    {
        _settings.Settings.Token = "";
        _settings.Save();
    }
}
