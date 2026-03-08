import supabase from './supabaseClient.js';

export async function submitRsvp(status) {
    // Determine the current authenticated user's email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("You must log in to RSVP.");
        return;
    }

    const email = user.email;

    try {
        // Upsert the RSVP. RLS ensures a user can only insert/update their own RSVP row.
        const { error } = await supabase
            .from('rsvps')
            .upsert({ email: email, status: status }, { onConflict: 'email' });

        if (error) {
            console.error("Supabase RSVP Error:", error.message);
            alert("Error saving RSVP. Please try again.");
            return false;
        }

        // Trigger the Edge Function to send email via Resend
        await supabase.functions.invoke('send-rsvp-email', {
            body: { email: email, status: status }
        });

        const rsvpStatusLbl = document.getElementById("rsvp-status");
        if (rsvpStatusLbl) {
            rsvpStatusLbl.innerText = `You RSVP'd: ${status.toUpperCase()}`;
            rsvpStatusLbl.style.color = status === 'yes' ? "#00ff88" : "#ff0055";
        }

        return true;
    } catch (err) {
        console.error("RSVP Exception:", err);
        return false;
    }
}
