namespace InvensoftDesktop.Core;

/// <summary>
/// Calls the backend's thermal print endpoint.
/// The backend notifies the Bridge (via WebSocket) which handles the actual printing.
/// Optionally falls back to sending directly to a local Bridge HTTP endpoint.
/// </summary>
public class PrintService
{
    private readonly ApiService _api;
    private readonly SettingsManager _settings;

    public PrintService(ApiService api, SettingsManager settings)
    {
        _api = api;
        _settings = settings;
    }

    /// <summary>
    /// Requests the backend to print a service order.
    /// Returns (true, "") on success, (false, errorMessage) on failure.
    /// </summary>
    public async Task<(bool Ok, string Error)> PrintServiceOrderAsync(int orderId, string paperSize = "80mm")
    {
        try
        {
            await _api.GetAsync<object>($"services/orders/{orderId}/print/thermal?paper_size={paperSize}");
            return (true, "");
        }
        catch (UnauthorizedAccessException) { return (false, "Sesión expirada."); }
        catch (Exception ex)               { return (false, $"Error al imprimir: {ex.Message}"); }
    }

    /// <summary>
    /// Requests the backend to print a quote.
    /// </summary>
    public async Task<(bool Ok, string Error)> PrintQuoteAsync(int quoteId, string paperSize = "80mm")
    {
        try
        {
            await _api.GetAsync<object>($"quotes/{quoteId}/print/thermal?paper_size={paperSize}");
            return (true, "");
        }
        catch (UnauthorizedAccessException) { return (false, "Sesión expirada."); }
        catch (Exception ex)               { return (false, $"Error al imprimir: {ex.Message}"); }
    }
}
