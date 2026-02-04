from django.urls import path

from .views import CategoryDeleteView, CategoryListCreateView

urlpatterns = [
	path("categories/", CategoryListCreateView.as_view(), name="category-list-create"),
	path("categories/<int:pk>/", CategoryDeleteView.as_view(), name="category-delete"),
]
