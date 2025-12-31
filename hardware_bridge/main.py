"""
Hardware Bridge - WebSocket Client
Connects to VPS and listens for print commands
No HTTP server - pure WebSocket client
"""
import asyncio
import websockets
import json
import os
import sys
import configparser
from pathlib import Path

# FIX: PyInstaller --noconsole sets stdout/stderr to None
if sys.stdout is None:
    sys.stdout = open("bridge_debug.log", "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open("bridge_debug.log", "w", encoding="utf-8")

# ========================================
# CONFIGURATION MANAGEMENT
# ========================================

def get_config_path():
    """Get path to config.ini in the same directory as the executable"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        app_dir = Path(sys.executable).parent
    else:
        # Running as script
        app_dir = Path(__file__).parent
    
    return app_dir / "config.ini"


def create_default_config(config_path):
    """Create default config.ini file"""
    config = configparser.ConfigParser()
    
    config['SERVIDOR'] = {
        'url_primary': 'wss://demo.invensoft.lat',
        'url_secondary': 'ws://localhost:8000',
        'nombre_caja': 'caja-1'
    }
    
    config['IMPRESORA'] = {
        'modo': 'VIRTUAL',
        'nombre': 'POS-58'
    }
    
    with open(config_path, 'w', encoding='utf-8') as f:
        config.write(f)
    
    print("="*60)
    print("⚠️  CONFIGURACIÓN INICIAL CREADA")
    print("="*60)
    print(f"Se ha creado el archivo: {config_path}")
    print()
    print("Por favor, edite el archivo config.ini con los datos correctos:")
    print("  - url_primary: URL del servidor VPS (ej: wss://cliente1.invensoft.lat)")
    print("  - url_secondary: URL del servidor Local (ej: ws://localhost:8000)")
    print("  - nombre_caja: Identificador único de esta caja (ej: caja-1)")
    print()
    print("Luego, reinicie el programa.")
    print("="*60)
    input("\nPresione ENTER para salir...")
    sys.exit(0)


def load_config():
    """Load configuration from config.ini"""
    config_path = get_config_path()
    
    # Create default config if doesn't exist
    if not config_path.exists():
        create_default_config(config_path)
    
    # Read config
    config = configparser.ConfigParser()
    try:
        config.read(config_path, encoding='utf-8')
        
        # Validate required sections
        if 'SERVIDOR' not in config or 'IMPRESORA' not in config:
            print(f"❌ Error: config.ini está incompleto o corrupto")
            print(f"Eliminando archivo corrupto...")
            config_path.unlink()
            create_default_config(config_path)
        
        # Extract values
        # Extract values (Support backward compatibility with url_servidor)
        url_primary = config['SERVIDOR'].get('url_primary')
        if not url_primary:
            url_primary = config['SERVIDOR'].get('url_servidor', 'wss://demo.invensoft.lat')
            
        url_secondary = config['SERVIDOR'].get('url_secondary', 'ws://localhost:8000')
        
        client_id = config['SERVIDOR'].get('nombre_caja', 'caja-1')
        printer_mode = config['IMPRESORA'].get('modo', 'VIRTUAL').upper()
        printer_name = config['IMPRESORA'].get('nombre', 'POS-58')
        
        return {
            'url_primary': url_primary,
            'url_secondary': url_secondary,
            'client_id': client_id,
            'printer_mode': printer_mode,
            'printer_name': printer_name
        }
    
    except Exception as e:
        print(f"❌ Error leyendo config.ini: {e}")
        print(f"Recreando archivo de configuración...")
        config_path.unlink(missing_ok=True)
        create_default_config(config_path)


# Load configuration
CONFIG = load_config()
# Load configuration
CONFIG = load_config()
URL_PRIMARY = CONFIG['url_primary']
URL_SECONDARY = CONFIG['url_secondary']
CLIENT_ID = CONFIG['client_id']
PRINTER_MODE = CONFIG['printer_mode']
PRINTER_NAME = CONFIG['printer_name']

print("="*60)
print("Hardware Bridge v3.1 - Hybrid Mode")
print("="*60)
print(f"Servidor Primario (VPS): {URL_PRIMARY}")
print(f"Servidor Secundario:     {URL_SECONDARY}")
print(f"Caja:                   {CLIENT_ID}")
print(f"Modo Impresora: {PRINTER_MODE}")
print(f"Nombre Impresora: {PRINTER_NAME}")
print("="*60)

# ========================================
# PRINTING FUNCTIONS (from old main.py)
# ========================================

def get_windows_printers():
    """List available Windows printers"""
    printers = []
    try:
        import win32print
        for p in win32print.EnumPrinters(2 | 4):
            printers.append(p[2])
    except Exception as e:
        print(f"Error listing printers: {e}")
    return printers


def print_to_windows(commands):
    """Print using Windows Print Spooler"""
    try:
        import win32print
        import win32ui
        from PIL import Image, ImageDraw, ImageFont
        
        # Open printer
        hPrinter = win32print.OpenPrinter(PRINTER_NAME)
        
        try:
            # Start print job
            hJob = win32print.StartDocPrinter(hPrinter, 1, ("Ticket", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)
            
            # Convert commands to ESC/POS
            esc_pos_data = b""
            
            for cmd in commands:
                if cmd['type'] == 'text':
                    text = cmd['content']
                    
                    # Alignment
                    if cmd['align'] == 'center':
                        esc_pos_data += b'\\x1b\\x61\\x01'  # Center
                    elif cmd['align'] == 'right':
                        esc_pos_data += b'\\x1b\\x61\\x02'  # Right
                    else:
                        esc_pos_data += b'\\x1b\\x61\\x00'  # Left
                    
                    # Bold
                    if cmd['bold']:
                        esc_pos_data += b'\\x1b\\x45\\x01'  # Bold ON
                    
                    # Text
                    esc_pos_data += text.encode('cp437', errors='replace') + b'\\n'
                    
                    # Reset bold
                    if cmd['bold']:
                        esc_pos_data += b'\\x1b\\x45\\x00'  # Bold OFF
                
                elif cmd['type'] == 'cut':
                    esc_pos_data += b'\\x1d\\x56\\x00'  # Cut
            
            # Send to printer
            win32print.WritePrinter(hPrinter, esc_pos_data)
            win32print.EndPagePrinter(hPrinter)
            win32print.EndDocPrinter(hPrinter)
            
            print(f"✅ Printed to {PRINTER_NAME}")
            return True
            
        finally:
            win32print.ClosePrinter(hPrinter)
            
    except Exception as e:
        print(f"❌ Print error: {e}")
        return False


def print_virtual(commands):
    """Print to console/file (for testing)"""
    width = 48
    output = []
    
    for cmd in commands:
        if cmd['type'] == 'cut':
            output.append('\\n' + '=' * width + ' [CORTE] ' + '=' * width + '\\n')
        elif cmd['type'] == 'text':
            content = cmd['content']
            
            if cmd['bold']:
                content = content.upper()
            
            if cmd['align'] == 'center':
                output.append(f"{content:^{width}}")
            elif cmd['align'] == 'right':
                output.append(f"{content:>{width}}")
            else:
                output.append(content)
    
    result = '\\n'.join(output)
    print(result)
    
    # Save to file
    with open("ticket_output.txt", "w", encoding="utf-8") as f:
        f.write(result)
    
    return True


def parse_format_tags(line, printer_output):
    """Parse formatting tags from template"""
    align = 'left'
    bold = False
    
    if '<center>' in line:
        align = 'center'
        line = line.replace('<center>', '').replace('</center>', '')
    elif '<right>' in line:
        align = 'right'
        line = line.replace('<right>', '').replace('</right>', '')
    elif '<left>' in line:
        align = 'left'
        line = line.replace('<left>', '').replace('</left>', '')
    
    if '<bold>' in line:
        bold = True
        line = line.replace('<bold>', '').replace('</bold>', '')
    
    if '<cut>' in line:
        printer_output.append({'type': 'cut'})
        return
    
    if not line.strip():
        return
    
    printer_output.append({
        'type': 'text',
        'content': line,
        'align': align,
        'bold': bold
    })


def print_from_template(template_str, context_data):
    """Render Jinja2 template and parse for printing"""
    from jinja2 import Template
    
    template = Template(template_str)
    rendered = template.render(context_data)
    
    printer_output = []
    lines = rendered.split('\\n')
    
    for line in lines:
        parse_format_tags(line, printer_output)
    
    return printer_output


def execute_print(payload):
    """Execute print command from payload"""
    try:
        template = payload.get('template')
        context = payload.get('context')
        
        if not template or not context:
            print("❌ Invalid payload: missing template or context")
            return False
        
        # Render template
        commands = print_from_template(template, context)
        
        # Print based on mode
        if PRINTER_MODE == "WINDOWS":
            return print_to_windows(commands)
        else:
            return print_virtual(commands)
            
    except Exception as e:
        print(f"❌ Print execution error: {e}")
        import traceback
        traceback.print_exc()
        return False


# ========================================
# WEBSOCKET CLIENT
# ========================================

async def connect_to_server(base_url, server_name):
    """Connect to a Server WebSocket and listen for print commands"""
    if not base_url or base_url.lower() == 'none':
        print(f"⚠️ {server_name}: No URL configured, skipping.")
        return

    # Normalize URL (remove trailing slash)
    base_url = base_url.rstrip('/')
    # Construct URI
    uri = f"{base_url}/api/v1/ws/hardware/{CLIENT_ID}"
    
    print(f"🔌 [{server_name}] Connecting to {uri}...")
    
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print(f"✅ [{server_name}] Connected successfully")
                
                # Listen for messages
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        print(f"\n📥 [{server_name}] Received: {data.get('type', 'unknown')}")
                        
                        if data.get('type') == 'print':
                            print(f"🖨️ [{server_name}] Processing print command sale #{data.get('sale_id')}")
                            payload = data.get('payload', {})
                            
                            # Run print in executor because it might be blocking (Win32)
                            loop = asyncio.get_event_loop()
                            success = await loop.run_in_executor(None, execute_print, payload)
                            
                            if success:
                                print(f"✅ [{server_name}] Print OK")
                            else:
                                print(f"❌ [{server_name}] Print FAILED")
                        
                        else:
                            print(f"⚠️ [{server_name}] Unknown type: {data.get('type')}")
                    
                    except json.JSONDecodeError:
                        print(f"❌ [{server_name}] Invalid JSON received")
                    except Exception as e:
                        print(f"❌ [{server_name}] Error processing: {e}")
        
        except (websockets.exceptions.WebSocketException, OSError) as e:
            # Connection failed or dropped
            # Don't print stack trace for simple connection errors to keep log clean
            print(f"❌ [{server_name}] Connection error: {e}")
            print(f"🔄 [{server_name}] Retrying in 5s...")
            await asyncio.sleep(5)
        
        except Exception as e:
            print(f"❌ [{server_name}] Unexpected error: {e}")
            await asyncio.sleep(5)


# ========================================
# MAIN
# ========================================

if __name__ == "__main__":
    try:
        # List available printers
        if PRINTER_MODE == "WINDOWS":
            printers = get_windows_printers()
            print(f"\\n📋 Available printers: {printers}")
            if PRINTER_NAME not in printers:
                print(f"⚠️ WARNING: Printer '{PRINTER_NAME}' not found!")
        
        # Start WebSocket client
        # Start WebSocket clients (Hybrid Mode)
        print("\n🚀 Starting Hybrid Bridge...")
        
        async def main():
            # Run both connections concurrently
            await asyncio.gather(
                connect_to_server(URL_PRIMARY, "PRIMARY"),
                connect_to_server(URL_SECONDARY, "SECONDARY")
            )

        asyncio.run(main())
    
    except KeyboardInterrupt:
        print("\\n\\n👋 Hardware Bridge stopped by user")
    except Exception as e:
        print(f"\\n\\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
