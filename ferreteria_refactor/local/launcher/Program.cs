using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MiInventarioLauncher;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new LauncherForm());
    }
}

class LauncherForm : Form
{
    // ── Rutas ──────────────────────────────────────────────────────────────
    static readonly string BaseDir = AppDomain.CurrentDomain.BaseDirectory;
    static string PgBin   => Path.Combine(BaseDir, "postgresql", "bin");
    static string PgData  => Path.Combine(BaseDir, "postgresql", "data");
    static string PgLog   => Path.Combine(BaseDir, "postgresql", "log.txt");
    static string PythonExe => Path.Combine(BaseDir, "python", "python.exe");
    static string BackendDir => Path.Combine(BaseDir, "backend");
    static string MediaDir   => Path.Combine(BackendDir, "media");
    const string AppUrl  = "http://localhost:8000";

    // ── Procesos ───────────────────────────────────────────────────────────
    Process? _uvicorn;
    bool _pgStartedByUs;
    bool _appReady;
    CancellationTokenSource _cts = new();

    // ── Controles UI ───────────────────────────────────────────────────────
    Label  _lblStatus   = null!;
    Label  _lblInfo     = null!;
    ProgressBar _progress = null!;
    Button _btnOpen     = null!;
    Button _btnStop     = null!;
    Panel  _panelTop    = null!;
    NotifyIcon _tray    = null!;

    public LauncherForm()
    {
        BuildUI();
        BuildTray();
        Load += async (_, _) => await StartSequenceAsync();
        FormClosing += OnFormClosing;
    }

    // ══════════════════════════════════════════════════════════════════════
    // UI
    // ══════════════════════════════════════════════════════════════════════
    void BuildUI()
    {
        Text            = "Mi Inventario Fácil";
        Size            = new Size(480, 300);
        MinimumSize     = new Size(480, 300);
        MaximumSize     = new Size(480, 300);
        StartPosition   = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox     = false;
        BackColor       = Color.FromArgb(245, 247, 250);

        // Header azul
        _panelTop = new Panel
        {
            Dock      = DockStyle.Top,
            Height    = 70,
            BackColor = Color.FromArgb(37, 99, 235),
        };

        var lblTitle = new Label
        {
            Text      = "Mi Inventario Fácil",
            ForeColor = Color.White,
            Font      = new Font("Segoe UI", 16, FontStyle.Bold),
            AutoSize  = true,
            Location  = new Point(20, 12),
        };
        var lblSub = new Label
        {
            Text      = "Sistema de Gestión de Negocios",
            ForeColor = Color.FromArgb(190, 219, 255),
            Font      = new Font("Segoe UI", 9),
            AutoSize  = true,
            Location  = new Point(22, 44),
        };
        _panelTop.Controls.Add(lblTitle);
        _panelTop.Controls.Add(lblSub);

        // Estado
        _lblStatus = new Label
        {
            Text      = "Iniciando...",
            Font      = new Font("Segoe UI", 11, FontStyle.Bold),
            ForeColor = Color.FromArgb(37, 99, 235),
            AutoSize  = true,
            Location  = new Point(20, 90),
        };

        // Barra de progreso
        _progress = new ProgressBar
        {
            Style    = ProgressBarStyle.Marquee,
            Location = new Point(20, 120),
            Size     = new Size(430, 14),
            MarqueeAnimationSpeed = 30,
        };

        // Info
        _lblInfo = new Label
        {
            Text      = "",
            Font      = new Font("Segoe UI", 9),
            ForeColor = Color.FromArgb(100, 116, 139),
            Size      = new Size(430, 60),
            Location  = new Point(20, 145),
        };

        // Botones
        _btnOpen = new Button
        {
            Text      = "Abrir Navegador",
            Location  = new Point(20, 220),
            Size      = new Size(150, 36),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(37, 99, 235),
            ForeColor = Color.White,
            Font      = new Font("Segoe UI", 9, FontStyle.Bold),
            Cursor    = Cursors.Hand,
            Enabled   = false,
        };
        _btnOpen.FlatAppearance.BorderSize = 0;
        _btnOpen.Click += (_, _) => OpenBrowser();

        _btnStop = new Button
        {
            Text      = "Detener",
            Location  = new Point(300, 220),
            Size      = new Size(150, 36),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(239, 68, 68),
            ForeColor = Color.White,
            Font      = new Font("Segoe UI", 9, FontStyle.Bold),
            Cursor    = Cursors.Hand,
            Enabled   = false,
        };
        _btnStop.FlatAppearance.BorderSize = 0;
        _btnStop.Click += OnStopClicked;

        Controls.Add(_panelTop);
        Controls.Add(_lblStatus);
        Controls.Add(_progress);
        Controls.Add(_lblInfo);
        Controls.Add(_btnOpen);
        Controls.Add(_btnStop);
    }

    void BuildTray()
    {
        _tray = new NotifyIcon
        {
            Text    = "Mi Inventario Fácil",
            Visible = false,
            Icon    = SystemIcons.Application,
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add("Abrir navegador", null, (_, _) => OpenBrowser());
        menu.Items.Add("Mostrar ventana",  null, (_, _) => { Show(); WindowState = FormWindowState.Normal; });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Detener y salir", null, OnStopClicked);
        _tray.ContextMenuStrip = menu;
        _tray.DoubleClick += (_, _) => { Show(); WindowState = FormWindowState.Normal; };
    }

    // ══════════════════════════════════════════════════════════════════════
    // Secuencia de arranque
    // ══════════════════════════════════════════════════════════════════════
    async Task StartSequenceAsync()
    {
        // Validaciones previas
        if (!File.Exists(Path.Combine(PgBin, "pg_ctl.exe")))
        {
            ShowError("PostgreSQL no encontrado en postgresql\\bin\\");
            return;
        }
        if (!Directory.Exists(PgData))
        {
            var setupBat = Path.Combine(BaseDir, "setup.bat");
            if (!File.Exists(setupBat))
            {
                ShowError("Base de datos no inicializada y setup.bat no encontrado.\nReinstale la aplicación.");
                return;
            }

            var result = MessageBox.Show(
                "La base de datos no ha sido inicializada todavía.\n\n" +
                "¿Desea configurarla ahora? (puede tardar 1-2 minutos)",
                "Mi Inventario Fácil — Primera vez",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);

            if (result != DialogResult.Yes) return;

            SetStatus("Configurando base de datos (primera vez)...", 0, 0);
            _lblInfo.Text = "Este proceso puede tardar 1-2 minutos.\nNo cierre esta ventana.";

            bool setupOk = await RunSetupAsync(setupBat);
            if (!setupOk)
            {
                var logPath = Path.Combine(BaseDir, "setup.log");
                ShowSetupError(logPath);
                return;
            }

            _lblInfo.Text = "";
        }
        if (!File.Exists(PythonExe))
        {
            ShowError("Python no encontrado en python\\");
            return;
        }

        Directory.CreateDirectory(MediaDir);

        try
        {
            // 1. PostgreSQL
            SetStatus("Iniciando base de datos...", 1, 4);
            if (!await StartPostgresAsync())
            {
                ShowError("PostgreSQL no pudo iniciar.\nRevise postgresql\\log.txt");
                return;
            }

            // 2. Servidor FastAPI
            SetStatus("Iniciando servidor web...", 2, 4);
            StartUvicorn();

            // 3. Esperar respuesta HTTP
            SetStatus("Cargando aplicación...", 3, 4);
            bool ready = await WaitForServerAsync(50, _cts.Token);
            if (!ready)
            {
                ShowError("El servidor no respondió en 50 segundos.\nRevise los logs del servidor.");
                StopAll();
                return;
            }

            // 4. Listo
            SetStatus("¡Aplicación lista!", 4, 4);
            _appReady = true;
            SetReadyState();
            OpenBrowser();
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            ShowError($"Error inesperado:\n{ex.Message}");
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Setup inicial (primera vez)
    // ══════════════════════════════════════════════════════════════════════
    async Task<bool> RunSetupAsync(string setupBat)
    {
        var logPath = Path.Combine(BaseDir, "setup.log");
        var logLines = new System.Text.StringBuilder();

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName               = "cmd.exe",
                Arguments              = $"/c \"{setupBat}\" /silent",
                WorkingDirectory       = BaseDir,
                UseShellExecute        = false,
                CreateNoWindow         = true,
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
            };

            var p = Process.Start(psi);
            if (p == null) return false;

            // Capturar stdout y stderr
            p.OutputDataReceived += (_, e) => { if (e.Data != null) logLines.AppendLine(e.Data); };
            p.ErrorDataReceived  += (_, e) => { if (e.Data != null) logLines.AppendLine("[ERR] " + e.Data); };
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();

            // Esperar hasta 5 minutos
            await Task.Run(() => p.WaitForExit(300_000));

            // Guardar log
            File.WriteAllText(logPath, logLines.ToString());

            return p.ExitCode == 0 && Directory.Exists(PgData);
        }
        catch (Exception ex)
        {
            File.WriteAllText(logPath, $"Excepción: {ex}");
            return false;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // PostgreSQL
    // ══════════════════════════════════════════════════════════════════════
    bool IsPgRunning()
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = Path.Combine(PgBin, "pg_isready.exe"),
                Arguments = "-h localhost -p 5432 -U postgres",
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
                UseShellExecute  = false,
                CreateNoWindow   = true,
            };
            var p = Process.Start(psi);
            p?.WaitForExit(5000);
            return p?.ExitCode == 0;
        }
        catch { return false; }
    }

    async Task<bool> StartPostgresAsync()
    {
        if (IsPgRunning()) return true;

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName  = Path.Combine(PgBin, "pg_ctl.exe"),
                Arguments = $"start -D \"{PgData}\" -l \"{PgLog}\"",
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
                UseShellExecute  = false,
                CreateNoWindow   = true,
            };
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            ShowError($"Error iniciando PostgreSQL:\n{ex.Message}");
            return false;
        }

        for (int i = 0; i < 20; i++)
        {
            await Task.Delay(1000, _cts.Token);
            if (IsPgRunning()) { _pgStartedByUs = true; return true; }
        }
        return false;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Uvicorn
    // ══════════════════════════════════════════════════════════════════════
    void StartUvicorn()
    {
        var psi = new ProcessStartInfo
        {
            FileName         = PythonExe,
            Arguments        = "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000",
            WorkingDirectory = BaseDir,
            UseShellExecute  = false,
            CreateNoWindow   = true,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
        };
        psi.EnvironmentVariables["PYTHONPATH"]       = BaseDir;
        psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
        psi.EnvironmentVariables["PYTHONUTF8"]       = "1";

        _uvicorn = Process.Start(psi);
        // Consumir streams para que el proceso no se bloquee
        if (_uvicorn != null)
        {
            Task.Run(() => _uvicorn.StandardOutput.ReadToEnd());
            Task.Run(() => _uvicorn.StandardError.ReadToEnd());
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Esperar servidor HTTP
    // ══════════════════════════════════════════════════════════════════════
    async Task<bool> WaitForServerAsync(int timeoutSec, CancellationToken ct)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (int i = 0; i < timeoutSec; i++)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var resp = await http.GetAsync(AppUrl, ct);
                if (resp.IsSuccessStatusCode) return true;
            }
            catch { }
            await Task.Delay(1000, ct);
        }
        return false;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Detener todo
    // ══════════════════════════════════════════════════════════════════════
    void StopAll()
    {
        _cts.Cancel();

        if (_uvicorn != null && !_uvicorn.HasExited)
        {
            try { _uvicorn.Kill(true); _uvicorn.WaitForExit(5000); } catch { }
        }

        if (_pgStartedByUs)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName  = Path.Combine(PgBin, "pg_ctl.exe"),
                    Arguments = $"stop -D \"{PgData}\" -m fast",
                    RedirectStandardOutput = true,
                    RedirectStandardError  = true,
                    UseShellExecute  = false,
                    CreateNoWindow   = true,
                };
                var p = Process.Start(psi);
                p?.WaitForExit(10000);
            }
            catch { }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Helpers UI (thread-safe)
    // ══════════════════════════════════════════════════════════════════════
    void SetStatus(string text, int step, int total)
    {
        if (InvokeRequired) { Invoke(() => SetStatus(text, step, total)); return; }
        _lblStatus.Text = $"[{step}/{total}] {text}";
    }

    void SetReadyState()
    {
        if (InvokeRequired) { Invoke(SetReadyState); return; }

        _lblStatus.Text      = "✓  Aplicación corriendo";
        _lblStatus.ForeColor = Color.FromArgb(22, 163, 74);
        _progress.Style      = ProgressBarStyle.Continuous;
        _progress.Value      = 100;

        _lblInfo.Text =
            $"URL:         {AppUrl}\n" +
            $"Usuario:     admin\n" +
            $"Contraseña:  admin123\n" +
            $"Red local:   http://[IP-de-esta-PC]:8000";

        _btnOpen.Enabled = true;
        _btnStop.Enabled = true;

        // Minimizar a bandeja
        _tray.Visible = true;
        _tray.ShowBalloonTip(3000, "Mi Inventario Fácil",
            "La aplicación está corriendo.\nHaz doble click para restaurar.", ToolTipIcon.Info);
    }

    void ShowSetupError(string logPath)
    {
        if (InvokeRequired) { Invoke(() => ShowSetupError(logPath)); return; }

        var logContent = File.Exists(logPath) && new FileInfo(logPath).Length > 0
            ? File.ReadAllText(logPath)
            : "(setup.log vacío — el proceso no generó salida)";

        // Ventana con log scrollable
        var dlg = new Form
        {
            Text            = "Mi Inventario Fácil — Error en setup",
            Size            = new Size(620, 440),
            StartPosition   = FormStartPosition.CenterParent,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox     = false,
        };
        var txt = new TextBox
        {
            Multiline  = true,
            ScrollBars = ScrollBars.Vertical,
            ReadOnly   = true,
            Dock       = DockStyle.Fill,
            Font       = new Font("Consolas", 9),
            Text       = logContent,
            BackColor  = Color.FromArgb(30, 30, 30),
            ForeColor  = Color.FromArgb(220, 220, 220),
        };
        var lblTop = new Label
        {
            Text      = "El setup inicial falló. Contenido de setup.log:",
            Dock      = DockStyle.Top,
            Height    = 26,
            Font      = new Font("Segoe UI", 9, FontStyle.Bold),
            ForeColor = Color.DarkRed,
            Padding   = new Padding(4),
        };
        var btnCopy = new Button
        {
            Text   = "Copiar log",
            Dock   = DockStyle.Bottom,
            Height = 32,
        };
        btnCopy.Click += (_, _) =>
        {
            try { Clipboard.SetText(logContent); }
            catch { MessageBox.Show("No se pudo copiar al portapapeles.\nAbra el archivo manualmente:\n" + logPath); }
        };
        dlg.Controls.Add(txt);
        dlg.Controls.Add(lblTop);
        dlg.Controls.Add(btnCopy);
        dlg.ShowDialog(this);

        // Actualizar estado en ventana principal
        _lblStatus.Text      = "Error en setup inicial";
        _lblStatus.ForeColor = Color.FromArgb(220, 38, 38);
        _progress.Style      = ProgressBarStyle.Continuous;
        _progress.Value      = 0;
        _lblInfo.Text        = $"Revise setup.log en:\n{logPath}";
        _btnStop.Enabled     = true;
    }

    void ShowError(string msg)
    {
        if (InvokeRequired) { Invoke(() => ShowError(msg)); return; }

        _lblStatus.Text      = "Error al iniciar";
        _lblStatus.ForeColor = Color.FromArgb(220, 38, 38);
        _progress.Style      = ProgressBarStyle.Continuous;
        _progress.Value      = 0;
        _lblInfo.Text        = msg;
        _btnStop.Enabled     = true;

        MessageBox.Show(msg, "Mi Inventario Fácil — Error",
            MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    void OpenBrowser()
    {
        try { Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true }); }
        catch { }
    }

    void OnStopClicked(object? sender, EventArgs e)
    {
        _btnStop.Enabled = false;
        _btnOpen.Enabled = false;
        SetStatus("Deteniendo servicios...", 0, 0);
        Task.Run(() =>
        {
            StopAll();
            Invoke(() =>
            {
                _tray.Visible = false;
                _tray.Dispose();
                Application.Exit();
            });
        });
    }

    void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (!_appReady) return;

        // Si la app está corriendo, minimizar a bandeja en vez de cerrar
        e.Cancel = true;
        Hide();
        _tray.ShowBalloonTip(2000, "Mi Inventario Fácil",
            "Sigue corriendo en la bandeja del sistema.\nHaz doble click para abrir.", ToolTipIcon.Info);
    }
}
