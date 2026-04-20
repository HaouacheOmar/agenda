
from django.contrib import admin
from django.urls import path , include
from .db_tools_views import ExportSQLiteView, ImportSQLiteView


urlpatterns = [
    path('admin/', admin.site.urls),
    path('event/', include('event.urls')),
    path('category/', include('category.urls')),
    path('data/export-sqlite/', ExportSQLiteView.as_view(), name='export-sqlite'),
    path('data/import-sqlite/', ImportSQLiteView.as_view(), name='import-sqlite'),
]
