from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from api.admin import admin_site

def api_root(request):
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Tricycle System | API Portal</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .card { background: white; padding: 3rem; border-radius: 2.5rem; shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1); max-width: 500px; width: 90%; text-align: center; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }
            .logo { background: #FFD700; width: 64px; height: 64px; border-radius: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; rotate: 3deg; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
            h1 { font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em; margin-bottom: 0.5rem; font-size: 1.875rem; color: #0f172a; }
            p { color: #64748b; margin-bottom: 2.5rem; font-weight: 500; }
            .links { display: flex; flex-direction: column; gap: 1rem; }
            .btn { text-decoration: none; padding: 1rem; border-radius: 1rem; font-weight: 700; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
            .btn-primary { background: #1e293b; color: white; }
            .btn-primary:hover { background: #0f172a; transform: translateY(-2px); }
            .btn-outline { border: 2px solid #e2e8f0; color: #475569; }
            .btn-outline:hover { background: #f1f5f9; border-color: #cbd5e1; }
            .status { margin-top: 2rem; font-size: 0.75rem; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
            .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="logo">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 10h8l-2 10"/></svg>
            </div>
            <h1>Smart Tricycle System</h1>
            <p>API & Management Portal Gateway</p>
            <div class="links">
                <a href="/admin/" class="btn btn-primary">Open Admin Console</a>
                <a href="/api/" class="btn btn-outline">Explore API Endpoints</a>
            </div>
            <div class="status">
                <div class="dot"></div> System Operational
            </div>
        </div>
    </body>
    </html>
    """
    return HttpResponse(html)

from django.urls import path, include, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin_site.urls),
    path('api/', include('api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    path('', api_root, name='api_root'),
]
