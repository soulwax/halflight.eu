"""Syn's isolated streamrip-based media worker.

The worker only treats streamrip as an installed, read-only dependency. It does
not import streamrip's TIDAL client because that client embeds credentials that
Syn must never copy or rely on.
"""
