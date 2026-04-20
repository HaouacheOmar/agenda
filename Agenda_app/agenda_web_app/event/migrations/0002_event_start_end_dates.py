from django.db import migrations, models


def copy_start_date_to_end_date(apps, schema_editor):
    Event = apps.get_model('event', 'Event')
    Event.objects.filter(end_date__isnull=True).update(end_date=models.F('start_date'))


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='event',
            old_name='planned_date',
            new_name='start_date',
        ),
        migrations.AddField(
            model_name='event',
            name='end_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(copy_start_date_to_end_date, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='event',
            name='end_date',
            field=models.DateTimeField(),
        ),
    ]
