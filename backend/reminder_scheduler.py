# reminder_scheduler.py

from datetime import datetime, timedelta
from typing import Callable, List, Dict, Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import func

from database import SessionLocal, Member  # uses your existing models :contentReference[oaicite:2]{index=2}


class ReminderScheduler:
    """
    Wraps APScheduler and knows how to:
    - query the DB
    - call SlackMessagingService
    for various reminder types.
    """

    def __init__(self, db_session_factory: Callable[[], SessionLocal], slack_service):
        self.db_session_factory = db_session_factory
        self.slack_service = slack_service
        self.scheduler = BackgroundScheduler()
        self.is_running = False

    # ---------- Lifecycle ----------

    def start(self):
        """Start the underlying scheduler."""
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True

    def shutdown(self):
        """Stop the scheduler."""
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False

    # ---------- Helpers ----------

    def _get_unpaid_members(
        self,
        statuses: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Query DB for members whose payment_status is in `statuses`.
        Returns a list of dicts compatible with SlackMessagingService.send_bulk_reminder_summary.
        """
        db = self.db_session_factory()
        try:
            normalized_statuses = set(s.lower() for s in statuses)
            members = (
                db.query(Member)
                .filter(
                    func.lower(Member.payment_status).in_(normalized_statuses)
                )
                .all()
            )

            unpaid_data = []
            for m in members:
                amount_due = (m.dues_amount or 0.0) - (m.amount_paid or 0.0)
                if amount_due <= 0:
                    continue

                unpaid_data.append(
                    {
                        "name": m.name,
                        "class": m.role,
                        "amount_due": amount_due,
                        "status": m.payment_status,
                    }
                )
            return unpaid_data
        finally:
            db.close()

    def _get_stats(self) -> Dict[str, Any]:
        """
        Compute the same stats as /api/stats for weekly Slack summary.
        Mirrors logic in app.get_statistics. :contentReference[oaicite:3]{index=3}
        """
        db = self.db_session_factory()
        try:
            total_members = db.query(Member).count()
            paid_members = db.query(Member).filter(Member.payment_status == "Paid").count()
            pending_members = db.query(Member).filter(Member.payment_status == "Pending").count()
            overdue_members = db.query(Member).filter(Member.payment_status == "Overdue").count()

            total_expected = db.query(func.sum(Member.dues_amount)).scalar() or 0
            total_collected = db.query(func.sum(Member.amount_paid)).scalar() or 0
            outstanding = total_expected - total_collected
            collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0

            return {
                "total_members": total_members,
                "paid_members": paid_members,
                "pending_members": pending_members,
                "overdue_members": overdue_members,
                "total_expected": float(total_expected),
                "total_collected": float(total_collected),
                "outstanding_balance": float(outstanding),
                "collection_rate": round(collection_rate, 2),
            }
        finally:
            db.close()

    # ---------- Job functions ----------

    def _job_daily_overdue(self):
        """Send Slack summary of all overdue members (called by APScheduler)."""
        unpaid = self._get_unpaid_members(["Overdue", "overdue"])
        if unpaid:
            self.slack_service.send_bulk_reminder_summary(unpaid)

    def _job_pending_reminder(self):
        """Send Slack summary of all pending members (for bi-weekly / weekly reminders)."""
        unpaid = self._get_unpaid_members(["Pending", "pending"])
        if unpaid:
            self.slack_service.send_bulk_reminder_summary(unpaid)

    def _job_weekly_summary(self):
        """Send weekly high-level stats to Slack."""
        stats = self._get_stats()
        self.slack_service.send_weekly_summary(stats)

    def _job_deadline_reminder(self, deadline_date: datetime):
        """
        Send Slack reminder about an upcoming payment deadline.
        """
        db = self.db_session_factory()
        try:
            total_members = db.query(Member).count()
            amt_expected = db.query(func.sum(Member.dues_amount)).scalar() or 0
            amt_collected = db.query(func.sum(Member.amount_paid)).scalar() or 0
            outstanding = amt_expected - amt_collected

            # Count members with any outstanding balance
            members_unpaid = (
                db.query(Member)
                .filter((Member.dues_amount - Member.amount_paid) > 0)
                .count()
            )
        finally:
            db.close()

        days_until = (deadline_date.date() - datetime.now().date()).days
        if days_until < 0:
            return  # deadline already passed

        self.slack_service.send_deadline_reminder(
            days_until_deadline=days_until,
            unpaid_count=members_unpaid,
            total_outstanding=float(outstanding),
        )

    # ---------- Public API used by app.py ----------

    def list_jobs(self) -> List[Dict[str, Any]]:
        """Return a serializable list of all scheduled jobs."""
        jobs_info = []
        for job in self.scheduler.get_jobs():
            jobs_info.append(
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run_time": job.next_run_time.isoformat()
                    if job.next_run_time
                    else None,
                }
            )
        return jobs_info

    def add_daily_overdue_reminder(self, hour: int = 9, minute: int = 0):
        """
        Schedule a job that runs every day at the specified time and
        sends an overdue summary to Slack.
        """
        trigger = CronTrigger(hour=hour, minute=minute)  # every day
        self.scheduler.add_job(
            self._job_daily_overdue,
            trigger=trigger,
            id="daily_overdue_reminder",
            replace_existing=True,
            name="Daily overdue reminder",
        )

    def add_weekly_summary(self, day_of_week: str = "mon", hour: int = 9, minute: int = 0):
        """
        Schedule a weekly summary (stats) Slack message.
        day_of_week: 'mon', 'tue', ..., 'sun'
        """
        trigger = CronTrigger(
            day_of_week=day_of_week.lower(),
            hour=hour,
            minute=minute,
        )
        self.scheduler.add_job(
            self._job_weekly_summary,
            trigger=trigger,
            id="weekly_summary",
            replace_existing=True,
            name="Weekly financial summary",
        )

    def add_bi_weekly_pending_reminder(
        self,
        day_of_week: str = "mon",
        hour: int = 9,
        minute: int = 0,
    ):
        """
        Schedule a bi-weekly reminder for Pending members.
        Uses an IntervalTrigger starting on the next chosen weekday.
        """
        # Map short weekday to Python weekday index
        dow_map = {
            "mon": 0,
            "tue": 1,
            "wed": 2,
            "thu": 3,
            "fri": 4,
            "sat": 5,
            "sun": 6,
        }
        target_dow = dow_map.get(day_of_week.lower(), 0)

        now = datetime.now()
        days_ahead = (target_dow - now.weekday()) % 7
        if days_ahead == 0 and (now.hour, now.minute) >= (hour, minute):
            # if it's already past today's scheduled time, start next week
            days_ahead = 7

        first_run = (now + timedelta(days=days_ahead)).replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )

        trigger = IntervalTrigger(weeks=2, start_date=first_run)

        self.scheduler.add_job(
            self._job_pending_reminder,
            trigger=trigger,
            id="biweekly_pending_reminder",
            replace_existing=True,
            name="Bi-weekly pending reminder",
        )

    def add_deadline_reminder(
        self,
        deadline_date: datetime,
        reminder_days_before: List[int],
        hour: int = 9,
        minute: int = 0,
    ):
        """
        Schedule one-off reminders X days before deadline.
        """
        for days_before in reminder_days_before:
            run_date = deadline_date - timedelta(days=days_before)
            # Use same time-of-day for each reminder
            run_date = run_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

            if run_date <= datetime.now():
                # Don't schedule reminders in the past
                continue

            job_id = f"deadline_reminder_{days_before}_days_before"
            trigger = DateTrigger(run_date)

            self.scheduler.add_job(
                self._job_deadline_reminder,
                trigger=trigger,
                id=job_id,
                replace_existing=True,
                name=f"Deadline reminder ({days_before} days before)",
                args=[deadline_date],
            )

    def pause_job(self, job_id: str):
        self.scheduler.pause_job(job_id)

    def resume_job(self, job_id: str):
        self.scheduler.resume_job(job_id)

    def remove_job(self, job_id: str):
        self.scheduler.remove_job(job_id)


# ---------- Helper to configure defaults on startup ----------

def setup_default_reminders(reminder_scheduler: ReminderScheduler, payment_deadline: datetime):
    """
    Called from app.startup_event in app.py :contentReference[oaicite:4]{index=4}
    to register some default jobs:
    - daily overdue reminder at 9:00
    - weekly summary on Monday at 9:00
    - bi-weekly pending reminder on Wednesday at 9:00
    - deadline reminders 7, 3, 1 days before payment_deadline
    """
    # Daily overdue at 9am
    reminder_scheduler.add_daily_overdue_reminder(hour=9, minute=0)

    # Weekly summary on Monday at 9am
    reminder_scheduler.add_weekly_summary(day_of_week="mon", hour=9, minute=0)

    # Bi-weekly pending on Wednesday at 9am
    reminder_scheduler.add_bi_weekly_pending_reminder(
        day_of_week="wed",
        hour=9,
        minute=0,
    )

    # Deadline reminders 7, 3, 1 days before
    reminder_scheduler.add_deadline_reminder(
        deadline_date=payment_deadline,
        reminder_days_before=[7, 3, 1],
        hour=9,
        minute=0,
    )
