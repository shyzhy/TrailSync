from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models

class Role(models.Model):
    class RoleName(models.TextChoices):
        STUDENT = "Student", "Student"
        ALUMNI = "Alumni", "Alumni"
        REGISTRAR = "Registrar Staff", "Registrar Staff"
        ADMIN = "Admin", "Admin"

    role_name = models.CharField(max_length=50, choices=RoleName.choices, unique=True)
    description = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.role_name

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("status", "Active")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None

    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        blank=True,
        null=True,
    )

    email = models.EmailField(unique=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ("Active", "Active"),
            ("Suspended", "Suspended"),
        ],
        default="Active",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return f"{self.email} - {self.get_full_name()}"

class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_profile",
    )

    school_id_number = models.CharField(max_length=50, unique=True)

    course = models.CharField(max_length=150, blank=True, null=True)
    college = models.CharField(max_length=150, blank=True, null=True)
    year_level = models.CharField(max_length=50, blank=True, null=True)

    user_category = models.CharField(
        max_length=50,
        choices=[
            ("Student", "Student"),
            ("Alumni", "Alumni"),
        ],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.user_category}"

class StaffProfile(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "Pending", "Pending"
        APPROVED = "Approved", "Approved"
        REJECTED = "Rejected", "Rejected"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile",
    )

    employee_id = models.CharField(max_length=50, unique=True)
    assigned_window = models.CharField(max_length=50, blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)

    availability_status = models.CharField(
        max_length=30,
        choices=[
            ("Available", "Available"),
            ("Unavailable", "Unavailable"),
        ],
        default="Available",
    )

    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_staff_profiles",
        blank=True,
        null=True,
    )
    approved_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee_id} - {self.user.get_full_name()}"



