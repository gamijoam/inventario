// 1. CONFIGURACIÓN DE LA API
// Si es localhost, usa puerto 8000. Si no, usa el MARCADOR que Docker reemplazará.
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '__API_URL_PLACEHOLDER__';

// 2. CONFIGURACIÓN DE LA APP (URL BASE)
const APP_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5173'
    : window.location.origin; // Usamos el origen actual (ej: https://qa.miinventariofacil.com)

// 3. FUNCIONES GLOBALES DEL MODAL
window.openRegisterModal = function (e) {
    if (e) e.preventDefault();
    console.log("Intentando abrir modal...");
    const modal = document.getElementById("registerModal");
    if (modal) {
        modal.style.display = "flex";
        console.log("Modal abierto exitosamente");
    } else {
        console.error("ERROR: No se encontró el elemento #registerModal");
    }
};

window.closeRegisterModal = function () {
    const modal = document.getElementById("registerModal");
    if (modal) modal.style.display = "none";
};

// --- DISCOVERY MODAL LOGIC (YA TENGO CUENTA) ---
window.openDiscoveryModal = function (e) {
    if (e) e.preventDefault();
    console.log("Intentando abrir modal de descubrimiento...");
    const modal = document.getElementById("discoveryModal");
    if (modal) {
        modal.style.display = "flex";
    } else {
        console.error("Discovery modal not found!");
    }
};

window.closeDiscoveryModal = function () {
    const modal = document.getElementById("discoveryModal");
    if (modal) modal.style.display = "none";
};

// Cerrar modal al hacer click fuera
window.onclick = function (event) {
    const regModal = document.getElementById("registerModal");
    const discModal = document.getElementById("discoveryModal");
    if (event.target == regModal) {
        regModal.style.display = "none";
    }
    if (event.target == discModal) {
        discModal.style.display = "none";
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // 1. Fetch version.json
    fetch('version.json')
        .then(response => response.json())
        .then(data => {
            const version = data.version;
            const downloadUrl = data.download_url;

            console.log(`Versión detectada: ${version}`);

            // 2. Actualizar textos de versión
            const badges = document.querySelectorAll('.badge');
            badges.forEach(badge => badge.textContent = `v${version}`);

            const vTags = document.querySelectorAll('.v-tag');
            vTags.forEach(tag => tag.textContent = '¡Nueva Versión Disponible!');

            const h3Versions = document.querySelectorAll('.version-info h3');
            h3Versions.forEach(h3 => h3.textContent = `POS Ultra v${version}`);

            // 3. Actualizar links de descarga
            if (downloadUrl && downloadUrl.length > 0) {
                const downloadButtons = document.querySelectorAll('.btn-download-large, .btn-primary');
                downloadButtons.forEach(btn => {
                    // Solo actualizamos si NO es el botón de submit del form
                    if (btn.type !== 'submit') {
                        btn.href = downloadUrl;
                        btn.removeAttribute('target');
                    }
                });
            }

        })
        .catch(error => console.error('Error cargando versión:', error));

    // Modal Global Handling
    const modal = document.getElementById("registerModal");
    const span = document.getElementsByClassName("close")[0];

    if (span) {
        span.onclick = function () {
            modal.style.display = "none";
        }
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // 4. LÓGICA DE CONTRASEÑA (Movida al final/global)


    // ... (rest of the code)

    // Form Handler
    const form = document.getElementById('registerForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const companyName = document.getElementById('companyName').value;
            const planType = document.getElementById('planType').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            const loadingMsg = document.getElementById('loadingMessage');
            const errorMsg = document.getElementById('errorMessage');
            const submitBtn = this.querySelector('button[type="submit"]');

            // 0. VALIDACIÓN DE CONTRASEÑAS
            if (password !== confirmPassword) {
                errorMsg.textContent = "❌ Las contraseñas no coinciden.";
                errorMsg.style.display = "block";
                // Shake animation effect for visual feedback
                const confirmInput = document.getElementById('confirmPassword');
                confirmInput.style.borderColor = "#EF4444";
                setTimeout(() => confirmInput.style.borderColor = "", 2000);
                return;
            }

            // UI Loading State
            loadingMsg.style.display = "block";
            errorMsg.style.display = "none";
            submitBtn.style.display = "none"; // Hide button completely

            // Start Progress Bar Animation (10s)
            const progressBar = document.getElementById('progressBar');
            // Force reflow
            void progressBar.offsetWidth;
            progressBar.style.transition = "width 10s linear";
            progressBar.style.width = "100%";

            // FIXED: API URL Normalization to avoid double /api/v1
            // Sometimes the injected API_URL already includes /api/v1
            const normalizedApiUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;

            try {
                // Remove /api/v1 from the string template since it's now handled in normalizedApiUrl
                const response = await fetch(`${normalizedApiUrl}/public/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        company_name: companyName,
                        plan_type: planType,
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    let errorDetail = data.detail || 'Error en el registro';
                    // If detail is an array (FastAPI validation), extract the first message
                    if (typeof errorDetail === 'object') {
                        errorDetail = JSON.stringify(errorDetail);
                        // Try to be nicer if it's a standard list of errors
                        if (Array.isArray(data.detail) && data.detail.length > 0) {
                            errorDetail = data.detail[0].msg || JSON.stringify(data.detail);
                        }
                    }
                    throw new Error(errorDetail);
                }

                localStorage.setItem('selected_tenant', data.tenant_id);

                setTimeout(() => {
                    // Update UI to show success briefly before redirect
                    loadingMsg.innerHTML = `<div class="text-secondary font-bold text-lg"><i class="fas fa-check-circle"></i> ¡Listo! Redirigiendo...</div>`;

                    // 3. LÓGICA DE REDIRECCIÓN CORREGIDA
                    const currentHost = window.location.hostname.replace(/^www\./, '');
                    let finalUrl;

                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        finalUrl = 'http://localhost:5173/login';
                    } else {
                        finalUrl = `https://${data.tenant_id}.${currentHost}/login`;
                    }

                    window.location.href = finalUrl;
                }, 10000); // Wait 10 seconds to match the visual bar

            } catch (err) {
                // Stop progress bar
                progressBar.style.transition = "none";
                progressBar.style.width = "0%";

                // Handle different error formats
                let msg = err.message;
                if (msg === '[object Object]') {
                    // Attempt to recover if we accidentally threw an object
                    msg = "Error desconocido en el servidor.";
                }

                // If the original data.detail was an array/object, try to prettify it locally?
                // Actually, let's fix the throw site first.
                // But here, let's ensure we don't show [object Object]

                errorMsg.textContent = "❌ " + msg;
                errorMsg.style.display = "block";
                submitBtn.style.display = "block"; // Show button again
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
                loadingMsg.style.display = "none";
            }
        });
    }


    // Validar visibilidad moviendo la funcion al scope global explícitamente y con logs
    window.togglePasswordVisibility = function (inputId, icon) {
        console.log("Toggling password for:", inputId);
        const input = document.getElementById(inputId);
        if (!input) {
            console.error("Input not found:", inputId);
            return;
        }

        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    };


    // Smooth scroll para navegación (Safeguard)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');

            // FIXED: Crash when href is replaced by external URL (e.g. version download)
            // If it's not an anchor link (does not start with #), let it behave normally.
            if (!targetId || !targetId.startsWith('#')) return;

            e.preventDefault();
            if (targetId === '#') return; // Ignore empty anchors

            try {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            } catch (err) {
                console.warn("Smooth scroll error ignored:", err);
            }
        });
    });

    // Mobile Menu Toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');

    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function () {
            navMenu.classList.toggle('active');
            const icon = this.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when clicking on a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function () {
                navMenu.classList.remove('active');
                const icon = mobileMenuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            });
        });
    }

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });
    // Discovery Form Handler
    const discoveryForm = document.getElementById('discoveryForm');
    if (discoveryForm) {
        discoveryForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const emailInput = document.getElementById('discoveryEmail');
            const email = emailInput.value.trim().toLowerCase();
            const messageArea = document.getElementById('discoveryMessage');
            const btnText = document.getElementById('discoveryBtnText');
            const spinner = document.getElementById('discoverySpinner');
            const submitBtn = this.querySelector('button[type="submit"]');

            // UI Reset
            messageArea.style.display = "none";
            messageArea.className = "message";
            spinner.style.display = "inline-block";
            btnText.textContent = "Buscando...";
            submitBtn.disabled = true;

            const normalizedApiUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;

            try {
                const response = await fetch(`${normalizedApiUrl}/auth/discovery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || 'No pudimos encontrar tu cuenta');
                }

                messageArea.textContent = "✅ ¡Cuenta encontrada! Redirigiendo...";
                messageArea.className = "message success";
                messageArea.style.display = "block";

                // Save tenant context (crucial for localhost)
                localStorage.setItem('selected_tenant', data.tenant_id);

                setTimeout(() => {
                    const currentHost = window.location.hostname.replace(/^www\./, '');
                    let finalUrl;

                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        // On localhost, redirect to the app dev server
                        finalUrl = 'http://localhost:5173/login';
                    } else {
                        // In production, use the URL provided by the backend
                        finalUrl = data.redirect_url;
                    }

                    window.location.href = finalUrl;
                }, 1000);

            } catch (err) {
                console.error("Discovery error:", err);
                messageArea.textContent = "❌ " + (err.message || 'Error desconocido');
                messageArea.className = "message error";
                messageArea.style.display = "block";

                spinner.style.display = "none";
                btnText.textContent = "Entrar a mi cuenta";
                submitBtn.disabled = false;
            }
        });
    }
});