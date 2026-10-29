<?php
namespace App\Http\Controllers;

use App\Models\Log;
use Illuminate\Http\Request;

/**
 * Journal d'activité : lecture seule, réservé à la direction.
 * Les lignes sont créées automatiquement (voir App\Models\Concerns\Journalise).
 */
class LogController extends Controller
{
    public function index(Request $request)
    {
        $query = Log::with('user:id,name,role');
        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->table) {
            $query->where('table_name', $request->table);
        }
        if ($request->action) {
            $query->where('action', $request->action);
        }
        if ($request->du) {
            $query->whereDate('created_at', '>=', $request->du);
        }
        if ($request->au) {
            $query->whereDate('created_at', '<=', $request->au);
        }
        $parPage = min((int) ($request->per_page ?: 20), 100);
        return response()->json($query->latest()->latest('id')->paginate($parPage));
    }

    public function show(Log $log)
    {
        return response()->json($log->load('user:id,name,role'));
    }
}
