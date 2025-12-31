
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

            // 3. Actualizar links de descarga (si el JSON tiene URL válida)
            if (downloadUrl && downloadUrl.length > 0) {
                // Si es relativa, ajustarla
                let finalUrl = downloadUrl;
                // Asumimos que si no empieza con http, es relativa a la carpeta descargas
                // O si el user configuró full path

                const downloadButtons = document.querySelectorAll('.btn-download-large, .btn-primary');
                downloadButtons.forEach(btn => {
                    btn.href = finalUrl;
                    btn.removeAttribute('target'); // Si es directo, quitar target blank a veces es mejor, pero opcional
                });
            }

        })
        .catch(error => console.error('Error cargando versión:', error));

    // Smooth scroll para navegación (existente)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});
