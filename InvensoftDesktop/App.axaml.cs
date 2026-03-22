using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Data.Core.Plugins;
using System.Linq;
using Avalonia.Markup.Xaml;
using InvensoftDesktop.Core;
using InvensoftDesktop.ViewModels;
using InvensoftDesktop.Views;
using Microsoft.Extensions.DependencyInjection;

namespace InvensoftDesktop;

public partial class App : Application
{
    public static IServiceProvider Services { get; private set; } = null!;

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        DisableAvaloniaDataAnnotationValidation();

        var collection = new ServiceCollection();
        ConfigureServices(collection);
        Services = collection.BuildServiceProvider();

        // Load persisted settings
        var settings = Services.GetRequiredService<SettingsManager>();
        settings.Load();

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            if (settings.Settings.IsLoggedIn)
            {
                desktop.MainWindow = BuildMainWindow();
            }
            else
            {
                desktop.MainWindow = BuildLoginWindow();
            }
        }

        base.OnFrameworkInitializationCompleted();
    }

    private LoginWindow BuildLoginWindow()
    {
        var loginVm = Services.GetRequiredService<LoginViewModel>();
        var loginWindow = new LoginWindow { DataContext = loginVm };

        loginVm.LoginSucceeded += () =>
        {
            var mainWindow = BuildMainWindow();
            mainWindow.Show();
            loginWindow.Close();

            if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
                desktop.MainWindow = mainWindow;
        };

        return loginWindow;
    }

    private MainWindow BuildMainWindow()
    {
        var mainVm = Services.GetRequiredService<MainWindowViewModel>();
        var mainWindow = new MainWindow { DataContext = mainVm };

        mainVm.LogoutRequested += () =>
        {
            var loginWindow = BuildLoginWindow();
            loginWindow.Show();
            mainWindow.Close();

            if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
                desktop.MainWindow = loginWindow;
        };

        return mainWindow;
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        // HTTP
        services.AddHttpClient();

        // Core
        services.AddSingleton<SettingsManager>();
        services.AddSingleton<AuthService>();
        services.AddSingleton<ApiService>();
        services.AddSingleton<BackendLauncher>();

        // ViewModels
        services.AddTransient<LoginViewModel>();
        services.AddSingleton<DashboardViewModel>();
        services.AddSingleton<ProductsViewModel>();
        services.AddSingleton<CashViewModel>();
        services.AddSingleton<POSViewModel>();
        services.AddTransient<MainWindowViewModel>();
    }

    private static void DisableAvaloniaDataAnnotationValidation()
    {
        var toRemove = BindingPlugins.DataValidators
            .OfType<DataAnnotationsValidationPlugin>().ToArray();
        foreach (var plugin in toRemove)
            BindingPlugins.DataValidators.Remove(plugin);
    }
}
