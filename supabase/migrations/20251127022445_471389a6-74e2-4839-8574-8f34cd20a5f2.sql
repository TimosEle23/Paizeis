-- Insert Cyprus tournaments with proper UUIDs
INSERT INTO tournaments (name, start_date, end_date, max_teams, prize, status, venue_id) VALUES
('Cyprus Padel Cup', '2026-01-01', '2026-12-31', 64, 'Trip to Abu Dhabi + Trophies + Rankings', 'upcoming', NULL),
('Shell Cyprus Corporate Padel Cup 2026', '2026-01-01', '2026-12-31', 32, 'Corporate Championship Trophy', 'upcoming', NULL),
('KickOff Winter League 2025/26', '2025-09-01', '2026-05-31', 32, 'League Championship Trophy', 'upcoming', NULL),
('APOEL Tournament U13 Boys U15 Girls', '2025-12-27', '2025-12-29', 16, 'Trophy + Medals', 'upcoming', NULL),
('Mavroudes Coerver Football Tournament 2025', '2026-01-10', '2026-01-11', 64, 'Trophies + Awards', 'upcoming', NULL),
('APOEL Nicosia Tournament 2026', '2026-04-14', '2026-04-16', 32, 'Championship Trophy', 'upcoming', NULL),
('Platres Football Tournament 2026', '2026-05-23', '2026-07-06', 64, 'Trophies + Medals', 'upcoming', NULL),
('Palaichori Youth Tournament 2026', '2026-05-30', '2026-06-21', 24, 'Trophy + Medals', 'upcoming', NULL),
('Omonoia Nicosia Football Tournament 2026', '2026-06-02', '2026-06-04', 32, 'Championship Trophy + Medals', 'upcoming', NULL)
ON CONFLICT DO NOTHING;