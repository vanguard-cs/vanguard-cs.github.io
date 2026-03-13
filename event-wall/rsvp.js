import supabase from './supabaseClient.js';

export async function submitRsvp(status) {
    // Determine the current authenticated user's email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("You must log in to RSVP.");
        return;
    }

    const email = user.email;
    const rsvpStatusLbl = document.getElementById("rsvp-status");

    try {
        // 1. Check if user already has an RSVP
        const { data: existing, error: fetchError } = await supabase
            .from('rsvps')
            .select('status')
            .eq('email', email)
            .maybeSingle();

        if (fetchError) {
            console.error("Error checking RSVP status:", fetchError);
        }

        if (existing) {
            if (rsvpStatusLbl) {
                rsvpStatusLbl.innerText = "You have RSVP'd. To change your RSVP contact Az.";
                rsvpStatusLbl.style.color = "#aaaaaa"; // Muted
            }
            return true;
        }

        // 2. Upsert the RSVP (First time)
        const { error: upsertError } = await supabase
            .from('rsvps')
            .upsert({ email: email, status: status }, { onConflict: 'email' });

        if (upsertError) {
            console.error("Supabase RSVP Error:", upsertError.message);
            alert("Error saving RSVP. Please try again.");
            return false;
        }

        // 3. Trigger the Edge Function to send email via Resend (Only on first submission)
        await supabase.functions.invoke('send-rsvp-email', {
            body: { email: email, status: status }
        });

        if (rsvpStatusLbl) {
            rsvpStatusLbl.innerText = "You have RSVP'd. To change your RSVP contact Az.";
            rsvpStatusLbl.style.color = "#aaaaaa";
        }

        return true;
    } catch (err) {
        console.error("RSVP Exception:", err);
        return false;
    }
}
