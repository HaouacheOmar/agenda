from django.contrib import admin
from django.urls import path , include
from .db_tools_views import ExportView, ImportView


urlpatterns = [
    path('admin/', admin.site.urls),
    path('event/', include('event.urls')),
    path('category/', include('category.urls')),
    path('data/export/', ExportView.as_view(), name='data-export'),
    path('data/import/', ImportView.as_view(), name='data-import'),
]
