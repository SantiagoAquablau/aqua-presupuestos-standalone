
ALTER TABLE public.budgets
  ADD COLUMN acc_projector_mini_led_qty integer DEFAULT 0,
  ADD COLUMN acc_projector_mini_led_model_id uuid DEFAULT NULL,
  ADD COLUMN acc_control_rgb_qty integer DEFAULT 1,
  ADD COLUMN acc_control_rgb_model_id uuid DEFAULT NULL;
