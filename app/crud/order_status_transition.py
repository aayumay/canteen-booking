from sqlalchemy.orm import Session

from app.models.order_status_transition import OrderStatusTransition


def list_transitions(db: Session) -> list[OrderStatusTransition]:
    return db.query(OrderStatusTransition).all()


def get_transition(
    db: Session, from_status: str, to_status: str, actor: str
) -> OrderStatusTransition | None:
    return (
        db.query(OrderStatusTransition)
        .filter(
            OrderStatusTransition.from_status == from_status,
            OrderStatusTransition.to_status == to_status,
            OrderStatusTransition.actor == actor,
        )
        .first()
    )


def seed_transitions(db: Session) -> None:
    transitions = [
        # Vendor forward flow
        OrderStatusTransition(from_status="placed", to_status="accepted", actor="vendor"),
        OrderStatusTransition(from_status="placed", to_status="rejected", actor="vendor", requires_reason=True),
        OrderStatusTransition(from_status="accepted", to_status="preparing", actor="vendor"),
        OrderStatusTransition(from_status="preparing", to_status="ready", actor="vendor"),
        OrderStatusTransition(from_status="ready", to_status="picked_up", actor="vendor"),
        # Student cancel
        OrderStatusTransition(from_status="placed", to_status="cancelled", actor="student"),
    ]
    for t in transitions:
        exists = get_transition(db, t.from_status, t.to_status, t.actor)
        if not exists:
            db.add(t)
    db.commit()
