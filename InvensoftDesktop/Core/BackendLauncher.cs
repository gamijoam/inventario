using System.Diagnostics;
using InvensoftDesktop.Models;

namespace InvensoftDesktop.Core;

/// <summary>
/// Gestiona el proceso del backend FastAPI en modo Local.
/// Detecta si ya está corriendo, lo inicia si no, y lo detiene al salir.
/// </summary>
public class BackendLauncher : IDisposable
{
    private readonly SettingsManager _settings;
    private Process? _process;

    // Ruta relativa al .exe de la app — el backend vive en ./backend/
    private static string BackendDir =>
        Path.Combine(AppContext.BaseDirectory, "backend");

    private static string BackendExe =>
        Path.Combine(BackendDir, OperatingSystem.IsWindows()
            ? "invensoft_api.exe"
            : "invensoft_api");

    public BackendLauncher(SettingsManager settings)
    {
        _settings = settings;
    }

    public bool BackendExeExists => File.Exists(BackendExe);

    /// <summary>Verifica si el backend responde en localhost.</summary>
    public async Task<bool> IsRunningAsync()
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var port = _settings.Settings.LocalPort;
            var response = await http.GetAsync($"http://localhost:{port}/api/v1/config/public");
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    /// <summary>
    /// Inicia el backend y espera hasta que responda (máx. 20 seg).
    /// Retorna (true, "") si arrancó bien, (false, mensaje) si falló.
    /// </summary>
    public async Task<(bool Ok, string Error)> StartAsync(
        IProgress<string>? progress = null)
    {
        if (!BackendExeExists)
            return (false, $"No se encontró el backend en:\n{BackendExe}");

        // Si ya responde, no hace falta levantarlo
        if (await IsRunningAsync())
            return (true, "");

        progress?.Report("Iniciando servidor local…");

        try
        {
            _process = Process.Start(new ProcessStartInfo
            {
                FileName = BackendExe,
                WorkingDirectory = BackendDir,
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = false,
                RedirectStandardError = false,
            });
        }
        catch (Exception ex)
        {
            return (false, $"No se pudo iniciar el servidor: {ex.Message}");
        }

        // Esperar hasta 20 segundos a que responda
        for (int i = 1; i <= 20; i++)
        {
            await Task.Delay(1000);
            progress?.Report($"Esperando servidor… ({i}/20)");
            if (await IsRunningAsync())
                return (true, "");
        }

        return (false, "El servidor tardó demasiado en iniciar. Verifica la instalación.");
    }

    public void Stop()
    {
        try { _process?.Kill(entireProcessTree: true); }
        catch { /* ignorar */ }
        _process = null;
    }

    public void Dispose() => Stop();
}
