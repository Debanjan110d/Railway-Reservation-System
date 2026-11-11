import pytest
from app.services.dsa_manager import dsa_manager

@pytest.fixture(autouse=True)
def reset_dsa_structures():
    dsa_manager.reset()
    yield
    dsa_manager.reset()

