from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import PerfilUsuario

class PerfilUsuarioInline(admin.StackedInline):
    model = PerfilUsuario
    can_delete = False
    verbose_name_plural = 'Perfil de Usuario (Sede)'

class CustomUserAdmin(UserAdmin):
    inlines = (PerfilUsuarioInline,)

# Re-registramos el modelo User para que use nuestro admin personalizado
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
