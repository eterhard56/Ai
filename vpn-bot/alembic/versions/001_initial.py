"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('telegram_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(255)),
        sa.Column('first_name', sa.String(255)),
        sa.Column('referral_code', sa.String(16), nullable=False, unique=True),
        sa.Column('referred_by_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('trial_used', sa.Boolean(), server_default='false'),
        sa.Column('is_blocked', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)

    op.create_table(
        'xray_servers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(128), nullable=False, unique=True),
        sa.Column('panel_url', sa.String(512), nullable=False),
        sa.Column('username', sa.String(128), nullable=False),
        sa.Column('password', sa.String(256), nullable=False),
        sa.Column('inbound_id', sa.Integer(), nullable=False),
        sa.Column('sub_domain', sa.String(256), nullable=False),
        sa.Column('sub_uri', sa.String(512), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('priority', sa.Integer(), server_default='100'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'tariffs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('price_rub', sa.Numeric(10, 2), nullable=False),
        sa.Column('duration_days', sa.Integer(), nullable=False),
        sa.Column('traffic_gb', sa.Integer(), server_default='0'),
        sa.Column('max_devices', sa.Integer(), server_default='1'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'devices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('server_id', sa.Integer(), sa.ForeignKey('xray_servers.id'), nullable=False),
        sa.Column('label', sa.String(128), server_default='Устройство'),
        sa.Column('x3ui_email', sa.String(128), nullable=False, unique=True),
        sa.Column('x3ui_uuid', sa.String(36), nullable=False),
        sa.Column('sub_id', sa.String(64), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_devices_user_id', 'devices', ['user_id'])

    op.create_table(
        'subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('device_id', sa.Integer(), sa.ForeignKey('devices.id'), unique=True),
        sa.Column('tariff_id', sa.Integer(), sa.ForeignKey('tariffs.id')),
        sa.Column('status', sa.Enum('active', 'expired', 'cancelled', name='subscriptionstatus'), server_default='active'),
        sa.Column('is_trial', sa.Boolean(), server_default='false'),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])

    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tariff_id', sa.Integer(), sa.ForeignKey('tariffs.id'), nullable=False),
        sa.Column('amount_rub', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.Enum('pending', 'paid', 'failed', 'cancelled', name='paymentstatus'), server_default='pending'),
        sa.Column('provider', sa.String(32), server_default='demo'),
        sa.Column('external_id', sa.String(128)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('paid_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_payments_user_id', 'payments', ['user_id'])

    op.create_table(
        'referral_bonuses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('referrer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('referred_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('bonus_days', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'support_tickets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('open', 'closed', name='ticketstatus'), server_default='open'),
        sa.Column('admin_reply', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_support_tickets_user_id', 'support_tickets', ['user_id'])


def downgrade() -> None:
    op.drop_table('support_tickets')
    op.drop_table('referral_bonuses')
    op.drop_table('payments')
    op.drop_table('subscriptions')
    op.drop_table('devices')
    op.drop_table('tariffs')
    op.drop_table('xray_servers')
    op.drop_table('users')
    op.execute('DROP TYPE IF EXISTS subscriptionstatus')
    op.execute('DROP TYPE IF EXISTS paymentstatus')
    op.execute('DROP TYPE IF EXISTS ticketstatus')
