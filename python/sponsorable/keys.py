"""The creator's signing key, and a local certificate chain for C2PA.

Two keys, for two jobs. The Ed25519 key signs licence receipts; its
fingerprint goes into the contract, which is what makes a self-generated key
sufficient: the sponsor contracted with the creator and can check it. The
P-256 key exists only because C2PA needs an X.509 chain, and its Ed25519 path
failed validation in testing. A C2PA validator shows that chain as an
unrecognised signer, which is correct: nobody vouches for it but the creator.

Both keys are created on first use under the Sponsorable home directory and
never leave the machine.
"""

from __future__ import annotations

import datetime as dt
import hashlib
from pathlib import Path

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

_PKCS8 = (serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())


def load_or_create(home: Path) -> Ed25519PrivateKey:
    """The creator's receipt-signing key, created under `home` the first time."""
    path = home / "key.pem"
    if path.exists():
        key = serialization.load_pem_private_key(path.read_bytes(), password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise ValueError(f"{path} is not an Ed25519 key")
        return key
    home.mkdir(parents=True, exist_ok=True)
    key = Ed25519PrivateKey.generate()
    path.write_bytes(key.private_bytes(*_PKCS8))
    return key


def public_hex(key: Ed25519PrivateKey) -> str:
    """The raw public key, hex."""
    return key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()


def fingerprint(public_key_hex: str) -> str:
    """A short, readable fingerprint to write into a contract: 8 groups of 4 hex."""
    digest = hashlib.sha256(bytes.fromhex(public_key_hex)).hexdigest()[:32]
    return " ".join(digest[i : i + 4] for i in range(0, 32, 4))


def sign(key: Ed25519PrivateKey, message: bytes) -> str:
    """Sign, returning hex."""
    return key.sign(message).hex()


def verify(public_key_hex: str, signature_hex: str, message: bytes) -> bool:
    """True when the signature is the named key's over the message."""
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex)).verify(bytes.fromhex(signature_hex), message)
        return True
    except (InvalidSignature, ValueError):
        return False


def _name(common: str) -> x509.Name:
    return x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, common), x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Sponsorable")]
    )


def _cert(
    subject: x509.Name,
    issuer: x509.Name,
    public: ec.EllipticCurvePublicKey,
    signer: ec.EllipticCurvePrivateKey,
    *,
    ca: bool,
    now: dt.datetime,
) -> x509.Certificate:
    """One certificate meeting the C2PA profile: key identifiers, usage, and EKU on the leaf."""
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(public)
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(days=1))
        .not_valid_after(now + dt.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(public), critical=False)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(signer.public_key()), critical=False)
    )
    if ca:
        builder = builder.add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), critical=True)
    else:
        builder = builder.add_extension(x509.KeyUsage(True, False, False, False, False, False, False, False, False), critical=True)
        builder = builder.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION]), critical=False)
    return builder.sign(signer, hashes.SHA256())


def c2pa_credentials(home: Path, creator: str) -> tuple[bytes, bytes]:
    """
    A certificate chain and private key for C2PA signing, created once.

    C2PA refuses a bare self-signed certificate, so a local root signs the
    leaf. The root exists only to satisfy the format, and its name says so.
    @returns (chain PEM, leaf private key PEM).
    """
    chain_path, key_path = home / "c2pa-chain.pem", home / "c2pa-key.pem"
    if chain_path.exists() and key_path.exists():
        return chain_path.read_bytes(), key_path.read_bytes()
    home.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)
    root_key, leaf_key = ec.generate_private_key(ec.SECP256R1()), ec.generate_private_key(ec.SECP256R1())
    root_name = _name("Sponsorable local root (not a trusted CA)")
    root = _cert(root_name, root_name, root_key.public_key(), root_key, ca=True, now=now)
    leaf = _cert(_name(creator or "Sponsorable creator"), root_name, leaf_key.public_key(), root_key, ca=False, now=now)
    chain = leaf.public_bytes(serialization.Encoding.PEM) + root.public_bytes(serialization.Encoding.PEM)
    chain_path.write_bytes(chain)
    key_path.write_bytes(leaf_key.private_bytes(*_PKCS8))
    return chain, key_path.read_bytes()
