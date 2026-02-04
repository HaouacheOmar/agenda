from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category
from rest_framework import serializers
from .serializers import CategorySerializer




class CategoryListCreateView(APIView):
	def get(self, request):
		categories = Category.objects.all().order_by("-date_created")
		serializer = CategorySerializer(categories, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def post(self, request):
		serializer = CategorySerializer(data=request.data)
		if serializer.is_valid():
			serializer.save()
			return Response(serializer.data, status=status.HTTP_201_CREATED)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CategoryDeleteView(APIView):
	def delete(self, request, pk):
		category = get_object_or_404(Category, pk=pk)
		category.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)
