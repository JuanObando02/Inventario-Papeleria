from django.db import models
from django.contrib.auth.models import User
from inventario.models import Sede

class PerfilUsuario(models.Model):
    ROLES = (
        ('ADMIN', 'Administrador'),
        ('EMPLEADO', 'Empleado'),
    )

    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    sede = models.ForeignKey(Sede, on_delete=models.PROTECT, null=True, blank=True)
    rol = models.CharField(max_length=15, choices=ROLES, default='EMPLEADO')
    
    class Meta:
        app_label = 'usuarios'

    def __str__(self):
        return f"{self.usuario.username} ({self.get_rol_display()}) - {self.sede.nombre if self.sede else 'Sin Sede'}"
