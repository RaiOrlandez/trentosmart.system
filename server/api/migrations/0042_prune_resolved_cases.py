from django.db import migrations

def prune_resolved_cases(apps, schema_editor):
    Incident = apps.get_model('api', 'Incident')
    Complaint = apps.get_model('api', 'Complaint')

    # Get all resolved incidents and closed complaints, ordered by created_at descending
    resolved_incidents = list(Incident.objects.filter(status='resolved').values('id', 'created_at'))
    closed_complaints = list(Complaint.objects.filter(status='closed').values('id', 'created_at'))

    # Label them to keep track
    for x in resolved_incidents:
        x['type'] = 'incident'
    for x in closed_complaints:
        x['type'] = 'complaint'

    # Combine and sort by created_at descending
    all_resolved = resolved_incidents + closed_complaints
    all_resolved.sort(key=lambda x: x['created_at'], reverse=True)

    # The first 50 are to be kept. The rest are to be deleted.
    to_delete = all_resolved[50:]
    
    incident_ids_to_delete = [x['id'] for x in to_delete if x['type'] == 'incident']
    complaint_ids_to_delete = [x['id'] for x in to_delete if x['type'] == 'complaint']

    if incident_ids_to_delete:
        Incident.objects.filter(id__in=incident_ids_to_delete).delete()
    if complaint_ids_to_delete:
        Complaint.objects.filter(id__in=complaint_ids_to_delete).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0041_user_selfie_with_license_user_tricycle_photo_and_more'),
    ]

    operations = [
        migrations.RunPython(prune_resolved_cases),
    ]
