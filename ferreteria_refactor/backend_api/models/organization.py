"""
Modelos SQLAlchemy — Sistema Multi-Empresa
Sprint 1 — feature/multi-empresa
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, Numeric,
    DateTime, Text, ForeignKey, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now


class Organization(Base):
    """Grupo empresarial — agrupa varios tenants bajo un mismo dueño."""
    __tablename__ = "organizations"
    __table_args__ = {"schema": "public"}

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(200), nullable=False)
    slug          = Column(String(100), unique=True, nullable=False, index=True)
    owner_email   = Column(String(255), nullable=False)
    owner_name    = Column(String(200), nullable=True)
    plan          = Column(String(50),  default="multi")   # duo | multi | enterprise
    max_tenants   = Column(Integer,     default=5)
    is_active     = Column(Boolean,     default=True)
    created_at    = Column(DateTime,    default=get_venezuela_now)
    logo_url      = Column(Text,        nullable=True)
    primary_color = Column(String(10),  default="#4F46E5")

    # ── WhatsApp compartido ──────────────────────────────────────────────────────
    # Si True, todas las empresas del grupo comparten una misma instancia de Baileys
    use_shared_whatsapp  = Column(Boolean,     default=False,  nullable=True)
    # Nombre de la instancia de Baileys compartida (ej: "grupo-rodriguez")
    whatsapp_instance    = Column(String(100), nullable=True)

    # ── Plan y facturación ────────────────────────────────────────────────────
    plan_expires_at      = Column(DateTime,    nullable=True)   # NULL = sin vencimiento
    plan_price           = Column(Numeric(10,2), default=0)     # Precio mensual acordado
    plan_notes           = Column(Text,        nullable=True)   # Notas internas del plan

    # Relaciones
    members  = relationship("OrganizationUser",    back_populates="organization", cascade="all, delete-orphan")
    products = relationship("SharedProduct",        back_populates="organization", cascade="all, delete-orphan")
    transfers= relationship("InterCompanyTransfer", back_populates="organization")
    chat_messages = relationship("OrganizationChatMessage", back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Organization(slug='{self.slug}', plan='{self.plan}')>"


class OrganizationUser(Base):
    """Usuarios que pueden cambiar entre empresas de una organización."""
    __tablename__ = "organization_users"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_email"),
        {"schema": "public"}
    )

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("public.organizations.id", ondelete="CASCADE"), nullable=False)
    user_email      = Column(String(255), nullable=False)
    role            = Column(String(50),  default="owner")   # owner | manager | viewer
    can_switch      = Column(Boolean,     default=True)
    invited_at      = Column(DateTime,    default=get_venezuela_now)
    accepted_at     = Column(DateTime,    nullable=True)

    organization = relationship("Organization", back_populates="members")

    def __repr__(self):
        return f"<OrganizationUser(email='{self.user_email}', role='{self.role}')>"


class SharedProduct(Base):
    """Catálogo compartido entre todas las empresas de una organización."""
    __tablename__ = "shared_products"
    __table_args__ = (
        UniqueConstraint("organization_id", "sku"),
        {"schema": "public"}
    )

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("public.organizations.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String(300), nullable=False)
    sku             = Column(String(100), nullable=True)
    description     = Column(Text,        nullable=True)
    cost_price      = Column(Numeric(14,4), default=0)
    suggested_price = Column(Numeric(14,4), default=0)
    category_name   = Column(String(100),   nullable=True)
    image_url       = Column(Text,          nullable=True)
    is_active       = Column(Boolean,       default=True)
    created_at      = Column(DateTime,      default=get_venezuela_now)

    organization = relationship("Organization", back_populates="products")

    def __repr__(self):
        return f"<SharedProduct(sku='{self.sku}', name='{self.name}')>"


class InterCompanyTransfer(Base):
    """Transferencia de stock entre empresas del mismo grupo."""
    __tablename__ = "inter_company_transfers"
    __table_args__ = (
        CheckConstraint("from_tenant_id <> to_tenant_id", name="chk_diff_tenants"),
        {"schema": "public"}
    )

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("public.organizations.id"), nullable=False)
    from_tenant_id  = Column(Integer, ForeignKey("public.tenants.id"),       nullable=False)
    to_tenant_id    = Column(Integer, ForeignKey("public.tenants.id"),       nullable=False)
    status          = Column(String(50), default="PENDING")  # PENDING | ACCEPTED | REJECTED | CANCELLED
    notes           = Column(Text,       nullable=True)
    created_by      = Column(Integer, ForeignKey("public.users.id"), nullable=True)
    created_at      = Column(DateTime, default=get_venezuela_now)
    completed_at    = Column(DateTime, nullable=True)

    organization  = relationship("Organization", back_populates="transfers")
    from_tenant   = relationship("Tenant", foreign_keys=[from_tenant_id])
    to_tenant     = relationship("Tenant", foreign_keys=[to_tenant_id])
    creator       = relationship("User",   foreign_keys=[created_by])
    items         = relationship("InterCompanyTransferItem", back_populates="transfer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Transfer(id={self.id}, from={self.from_tenant_id}, to={self.to_tenant_id}, status='{self.status}')>"


class InterCompanyTransferItem(Base):
    """Ítems de una transferencia entre empresas."""
    __tablename__ = "inter_company_transfer_items"
    __table_args__ = {"schema": "public"}

    id           = Column(Integer, primary_key=True, index=True)
    transfer_id  = Column(Integer, ForeignKey("public.inter_company_transfers.id", ondelete="CASCADE"), nullable=False)
    product_sku  = Column(String(100), nullable=False)
    product_name = Column(String(300), nullable=False)
    quantity     = Column(Numeric(12,3), nullable=False)
    unit_cost    = Column(Numeric(14,4), default=0)

    transfer = relationship("InterCompanyTransfer", back_populates="items")

    def __repr__(self):
        return f"<TransferItem(sku='{self.product_sku}', qty={self.quantity})>"


class OrganizationChatMessage(Base):
    """Mensajes internos del portal empresarial entre empresas de una organizacion."""
    __tablename__ = "organization_chat_messages"
    __table_args__ = {"schema": "public"}

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("public.organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_email    = Column(String(255), nullable=False, index=True)
    sender_name     = Column(String(200), nullable=True)
    tenant_id       = Column(Integer, ForeignKey("public.tenants.id"), nullable=True, index=True)
    message         = Column(Text, nullable=False, default="")
    created_at      = Column(DateTime, default=get_venezuela_now, index=True)

    organization = relationship("Organization", back_populates="chat_messages")
    tenant       = relationship("Tenant", foreign_keys=[tenant_id])
    attachments  = relationship("OrganizationChatAttachment", back_populates="message", cascade="all, delete-orphan")


class OrganizationChatAttachment(Base):
    """Adjuntos enviados en el chat interno de organizaciones."""
    __tablename__ = "organization_chat_attachments"
    __table_args__ = {"schema": "public"}

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("public.organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id      = Column(Integer, ForeignKey("public.organization_chat_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_url      = Column(Text, nullable=False)
    content_type    = Column(String(120), nullable=True)
    file_size       = Column(Integer, nullable=True)
    created_at      = Column(DateTime, default=get_venezuela_now)

    message = relationship("OrganizationChatMessage", back_populates="attachments")
