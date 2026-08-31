import { z } from "zod";

// Auth validation schemas
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72, { message: "Password must be less than 72 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be less than 100 characters" }),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255),
  password: z
    .string()
    .min(1, { message: "Password is required" }),
});

// Booking validation schemas
export const bookingSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(1, { message: "Team name is required" })
    .max(100, { message: "Team name must be less than 100 characters" }),
  playerName: z
    .string()
    .trim()
    .min(1, { message: "Player name is required" })
    .max(100, { message: "Player name must be less than 100 characters" }),
});

// Profile validation schemas
export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  phone: z
    .string()
    .trim()
    .max(20, { message: "Phone must be less than 20 characters" })
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .max(200, { message: "Location must be less than 200 characters" })
    .optional()
    .or(z.literal("")),
});

// CRM validation schemas
export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Client name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(20, { message: "Phone must be less than 20 characters" })
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(1000, { message: "Notes must be less than 1000 characters" })
    .optional()
    .or(z.literal("")),
});

export const dealSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Deal title is required" })
    .max(200, { message: "Title must be less than 200 characters" }),
  clientId: z
    .string()
    .uuid({ message: "Please select a valid client" }),
  value: z
    .number()
    .min(0, { message: "Value must be positive" })
    .max(999999999, { message: "Value is too large" }),
  stage: z
    .string()
    .min(1, { message: "Stage is required" }),
  expectedCloseDate: z
    .string()
    .optional()
    .or(z.literal("")),
});

export const invoiceSchema = z.object({
  clientId: z
    .string()
    .uuid({ message: "Please select a valid client" }),
  amount: z
    .number()
    .min(0, { message: "Amount must be positive" })
    .max(999999999, { message: "Amount is too large" }),
  status: z
    .string()
    .min(1, { message: "Status is required" }),
  dueDate: z
    .string()
    .min(1, { message: "Due date is required" }),
});

// Admin venue validation schema
export const venueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Venue name is required" })
    .max(200, { message: "Name must be less than 200 characters" }),
  city: z
    .string()
    .trim()
    .min(1, { message: "City is required" })
    .max(100, { message: "City must be less than 100 characters" }),
  location: z
    .string()
    .trim()
    .min(1, { message: "Location is required" })
    .max(500, { message: "Location must be less than 500 characters" }),
  phone: z
    .string()
    .trim()
    .max(20, { message: "Phone must be less than 20 characters" })
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(500, { message: "Website URL must be less than 500 characters" })
    .optional()
    .or(z.literal("")),
  image_url: z
    .string()
    .trim()
    .max(1000, { message: "Image URL must be less than 1000 characters" })
    .optional()
    .or(z.literal("")),
  google_rating: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 5;
    }, { message: "Rating must be between 0 and 5" }),
  google_reviews_count: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val || val === "") return true;
      const num = parseInt(val);
      return !isNaN(num) && num >= 0;
    }, { message: "Review count must be a positive number" }),
  booking_method: z
    .string()
    .trim()
    .max(100, { message: "Booking method must be less than 100 characters" })
    .optional()
    .or(z.literal("")),
});

// Venue manager creation validation schema
export const venueManagerSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  venueId: z
    .string()
    .uuid({ message: "Please select a valid venue" }),
  password: z
    .string()
    .min(12, { message: "Password must be at least 12 characters" }),
});
