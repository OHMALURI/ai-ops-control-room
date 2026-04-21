from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="viewer", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    audit_logs = relationship("AuditLog", back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role={self.role!r}>"


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    owner = Column(String, nullable=False)
    environment = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    base_url = Column(String, nullable=True)                 # For local providers (LM Studio, Ollama)
    system_prompt = Column(String, nullable=True)
    api_key_ref = Column(String, nullable=True)
    data_sensitivity = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    evaluations = relationship("Evaluation", back_populates="service", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="service", cascade="all, delete-orphan")
    drift_judge_results = relationship("DriftJudgeResult", back_populates="service", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Service id={self.id} name={self.name!r} environment={self.environment!r}>"


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    quality_score = Column(Float, nullable=False)          # overall average
    check_results = Column(String, nullable=False)          # JSON stored as string
    drift_triggered = Column(Boolean, default=False, nullable=False)
    drift_type      = Column(String, nullable=True)         # "Accuracy Decay", "Alignment Shift", etc.
    drift_reason    = Column(String, nullable=True)         # e.g., "Accuracy dropped from 90 to 45"
    latency_ms = Column(Integer, nullable=True)
    dataset_type = Column(String, nullable=True)            # which golden dataset was used

    # Evaluation metrics (0-100)
    accuracy             = Column(Float, nullable=True)
    relevance_score      = Column(Float, nullable=True)
    factuality_score     = Column(Float, nullable=True)
    toxicity_score       = Column(Float, nullable=True)
    instruction_following= Column(Float, nullable=True)

    # Relationship
    service = relationship("Service", back_populates="evaluations")

    def __repr__(self) -> str:
        return (
            f"<Evaluation id={self.id} service_id={self.service_id} "
            f"dataset_type={self.dataset_type} quality_score={self.quality_score}>"
        )



class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    severity = Column(String, nullable=False)
    symptoms = Column(String, nullable=False)
    timeline = Column(String, nullable=False)
    status = Column(String, default="open", nullable=False)
    llm_summary = Column(String, nullable=True)
    approved = Column(Boolean, default=False, nullable=False)
    checklist_json = Column(String, nullable=True)   # JSON stored as string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    service = relationship("Service", back_populates="incidents")
    maintenance_records = relationship("Maintenance", back_populates="incident", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return (
            f"<Incident id={self.id} service_id={self.service_id} "
            f"severity={self.severity!r} status={self.status!r}>"
        )


class Maintenance(Base):
    __tablename__ = "maintenance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    risk_level = Column(String, nullable=False)
    rollback_plan = Column(String, nullable=False)
    validation_steps = Column(String, nullable=False)
    approved = Column(Boolean, default=False, nullable=False)
    next_eval_date = Column(DateTime, nullable=True)

    # Relationship
    incident = relationship("Incident", back_populates="maintenance_records")

    def __repr__(self) -> str:
        return (
            f"<Maintenance id={self.id} incident_id={self.incident_id} "
            f"risk_level={self.risk_level!r} approved={self.approved}>"
        )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return (
            f"<AuditLog id={self.id} user_id={self.user_id} "
            f"action={self.action!r} resource={self.resource!r}>"
        )


class DriftJudgeResult(Base):
    __tablename__ = "drift_judge_results"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    service_id      = Column(Integer, ForeignKey("services.id"), nullable=False)
    timestamp       = Column(DateTime, default=datetime.utcnow, nullable=False)
    judge_model     = Column(String, nullable=False)
    tools_used      = Column(String, nullable=False)   # JSON array as string
    baseline_samples= Column(String, nullable=False)
    live_samples    = Column(String, nullable=False)
    drift_detected  = Column(String, nullable=False)   # "Major"|"Minor"|"None"
    shift_type      = Column(String, nullable=False)
    top_new_keyword = Column(String, nullable=True)
    severity_score  = Column(Integer, nullable=False)
    short_reason    = Column(String, nullable=True)
    raw_response    = Column(String, nullable=True)    # full LLM JSON string

    # Relationship
    service = relationship("Service", back_populates="drift_judge_results")

    def __repr__(self) -> str:
        return (
            f"<DriftJudgeResult id={self.id} service_id={self.service_id} "
            f"drift_detected={self.drift_detected!r} judge_model={self.judge_model!r}>"
        )
