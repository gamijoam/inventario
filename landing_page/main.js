window.openRegisterModal = function (e) {
    if (e) e.preventDefault();
    const modal = document.getElementById("registerModal");
    if (modal) modal.style.display = "flex";
};

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

    // Form Handler
    const form = document.getElementById('registerForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const companyName = document.getElementById('companyName').value;
            const planType = document.getElementById('planType').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const loadingMsg = document.getElementById('loadingMessage');
            const errorMsg = document.getElementById('errorMessage');
            const submitBtn = this.querySelector('button[type="submit"]');

            // UI Loading State
            loadingMsg.style.display = "block";
            errorMsg.style.display = "none";
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.7";

            try {
                const response = await fetch('http://localhost:8000/api/v1/public/register', {
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
                    throw new Error(data.detail || 'Error en el registro');
                }

                // Success
                loadingMsg.innerHTML = `<i class="fas fa-check-circle" style="color: green;"></i> ¡Empresa Creada!<br>
            <strong>ID de Empresa:</strong> ${data.tenant_id}<br>
            Redirigiendo al Login...`;

                // Simular redirección
                localStorage.setItem('selected_tenant', data.tenant_id);

                setTimeout(() => {
                    window.location.href = 'http://localhost:5173/login';
                }, 3000);

            } catch (err) {
                errorMsg.textContent = "❌ " + err.message;
                errorMsg.style.display = "block";
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
                loadingMsg.style.display = "none";
            }
        });
    }

    // Smooth scroll para navegación (Safeguard)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return; // Ignore empty anchors

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
