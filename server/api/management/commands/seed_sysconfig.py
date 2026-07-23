"""
Management command: seed_sysconfig
-----------------------------------
Idempotently inserts required SystemConfig defaults so the system works
correctly out-of-the-box (new deployments, fresh databases, test environments).

All values align with LGU Trento tricycle dispatch ordinance.

Usage:
    python manage.py seed_sysconfig
    python manage.py seed_sysconfig --force   # overwrite existing values
"""

from django.core.management.base import BaseCommand
from api.models import SystemConfig


DEFAULTS = {
    # === Fare / Pricing ===
    "base_fare":            ("30.00", "LGU minimum flag-down fare in PHP"),
    "rate_per_km":          ("8.00",  "PHP per km beyond base distance"),
    "base_distance":        ("2.00",  "Km included in base fare (no extra charge)"),
    "surge_multiplier":     ("1.00",  "Real-time demand surge factor (1.0 = no surge)"),
    "surge_threshold":      ("0.80",  "Driver availability ratio below which surge activates"),
    # === Capacity / Fleet ===
    "max_capacity":         ("5",     "Max passengers per tricycle"),
    "booking_radius_km":    ("5.00",  "Radius (km) used when matching passenger to drivers"),
    # === SOS / Safety ===
    "sos_alert_phone":      ("",      "Emergency contact phone number for SOS notifications"),
    "sos_alert_email":      ("",      "Emergency contact email for SOS notifications"),
    # === Finance / Commission ===
    "lgu_commission_rate":  ("5.00",  "LGU commission rate (%) applied to every completed ride fare. Driver receives (100 - rate)%."),
}


class Command(BaseCommand):
    help = "Seed SystemConfig with LGU-compliant default values (safe to re-run)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing values (default: skip keys that already exist).",
        )

    def handle(self, *args, **options):
        force = options["force"]
        created_count = 0
        skipped_count = 0
        updated_count = 0

        for key, (value, description) in DEFAULTS.items():
            obj, created = SystemConfig.objects.get_or_create(
                key=key,
                defaults={"value": value, "description": description},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"  [CREATED] {key} = {value}"))
                created_count += 1
            elif force:
                obj.value = value
                obj.description = description
                obj.save(update_fields=["value", "description"])
                self.stdout.write(self.style.WARNING(f"  [UPDATED] {key} = {value}"))
                updated_count += 1
            else:
                self.stdout.write(f"  [SKIP]    {key} already = {obj.value}")
                skipped_count += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created: {created_count}, Updated: {updated_count}, Skipped: {skipped_count}."
        ))
