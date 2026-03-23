using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Employees;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class EmployeesViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private ObservableCollection<Employee> _employees = new();
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";

    // Formulario de creacion
    [ObservableProperty] private bool _showCreateForm = false;
    [ObservableProperty] private string _newUsername = "";
    [ObservableProperty] private string _newPassword = "";
    [ObservableProperty] private string _newEmail = "";
    [ObservableProperty] private string _newFullName = "";
    [ObservableProperty] private string _newRole = "CASHIER";
    [ObservableProperty] private string _newCommission = "0.00";

    public EmployeesViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            // GET /api/v1/users/ devuelve todos los usuarios del tenant
            var result = await _api.GetAsync<List<Employee>>("users");
            Employees.Clear();
            if (result != null)
            {
                // Excluir superusuarios del listado de empleados
                foreach (var e in result.Where(e => !e.IsSuperuser))
                    Employees.Add(e);
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesion expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error al cargar empleados: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private void ToggleCreateForm()
    {
        ShowCreateForm = !ShowCreateForm;
        if (!ShowCreateForm)
            ClearForm();
    }

    [RelayCommand]
    private async Task CreateEmployeeAsync()
    {
        if (string.IsNullOrWhiteSpace(NewUsername))
        {
            ErrorMessage = "El nombre de usuario es obligatorio.";
            return;
        }
        if (string.IsNullOrWhiteSpace(NewPassword) || NewPassword.Length < 4)
        {
            ErrorMessage = "La contrasena debe tener al menos 4 caracteres.";
            return;
        }
        if (string.IsNullOrWhiteSpace(NewEmail))
        {
            ErrorMessage = "El correo electronico es obligatorio.";
            return;
        }

        if (!decimal.TryParse(
                NewCommission.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var commission))
        {
            commission = 0m;
        }

        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var req = new CreateEmployeeRequest
            {
                Username             = NewUsername.Trim(),
                Password             = NewPassword,
                Email                = NewEmail.Trim(),
                FullName             = string.IsNullOrWhiteSpace(NewFullName) ? null : NewFullName.Trim(),
                Role                 = NewRole,
                CommissionPercentage = commission
            };

            var created = await _api.PostAsync<CreateEmployeeRequest, Employee>("users", req);
            if (created != null)
            {
                Employees.Add(created);
                SuccessMessage = $"Empleado '{created.DisplayName}' creado correctamente.";
                ShowCreateForm = false;
                ClearForm();
            }
            else
            {
                ErrorMessage = "No se pudo crear el empleado.";
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesion expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error al crear empleado: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    private void ClearForm()
    {
        NewUsername   = "";
        NewPassword   = "";
        NewEmail      = "";
        NewFullName   = "";
        NewRole       = "CASHIER";
        NewCommission = "0.00";
    }
}
