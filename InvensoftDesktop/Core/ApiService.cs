using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace InvensoftDesktop.Core;

public class ApiService
{
    private readonly HttpClient _http;
    private readonly SettingsManager _settings;

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public ApiService(IHttpClientFactory factory, SettingsManager settings)
    {
        _http = factory.CreateClient();
        _settings = settings;
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string endpoint, HttpContent? content = null)
    {
        var s = _settings.Settings;
        var url = $"{s.ServerUrl.TrimEnd('/')}/api/v1/{endpoint}";
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", s.Token);
        request.Headers.Add("x-tenant-id", s.TenantSlug);
        if (content != null) request.Content = content;
        return request;
    }

    public async Task<T?> GetAsync<T>(string endpoint)
    {
        var request = BuildRequest(HttpMethod.Get, endpoint);
        var response = await _http.SendAsync(request);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException();
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<T>(JsonOpts);
    }

    public async Task<TRes?> PostAsync<TReq, TRes>(string endpoint, TReq body)
    {
        var content = JsonContent.Create(body);
        var request = BuildRequest(HttpMethod.Post, endpoint, content);
        var response = await _http.SendAsync(request);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException();
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<TRes>(JsonOpts);
    }

    public async Task<TRes?> PostFormAsync<TRes>(string endpoint, IEnumerable<KeyValuePair<string, string>> fields)
    {
        var content = new FormUrlEncodedContent(fields);
        var request = BuildRequest(HttpMethod.Post, endpoint, content);
        var response = await _http.SendAsync(request);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException();
        if (!response.IsSuccessStatusCode) return default;
        return await response.Content.ReadFromJsonAsync<TRes>(JsonOpts);
    }

    public async Task<bool> DeleteAsync(string endpoint)
    {
        var request = BuildRequest(HttpMethod.Delete, endpoint);
        var response = await _http.SendAsync(request);
        return response.IsSuccessStatusCode;
    }
}
